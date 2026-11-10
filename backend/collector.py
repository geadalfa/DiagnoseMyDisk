"""
collector.py
Mengumpulkan telemetri hardware disk secara live dari Windows Storage & WMI
menggunakan query deterministik berkecepatan tinggi tanpa memunculkan jendela console (silent),
dilengkapi multi-tier fallback (CIM WMI -> Hardware Cache INI -> Synthetic Fallback).
"""

import os
import re
import json
import subprocess
import ctypes

try:
    from smart_decoder import (
        decode_ata_smart_table,
        calculate_sata_true_health,
        calculate_nvme_true_health,
        calculate_hdd_health,
        ATA_SMART_NAMES,
        NVME_SMART_NAMES,
    )
    from hardware_profile import detect_hardware_profile
except ImportError:
    from backend.smart_decoder import (
        decode_ata_smart_table,
        calculate_sata_true_health,
        calculate_nvme_true_health,
        calculate_hdd_health,
        ATA_SMART_NAMES,
        NVME_SMART_NAMES,
    )
    from backend.hardware_profile import detect_hardware_profile

SMART_CACHE_DIR = r"C:\Program Files\CrystalDiskInfo\Smart"


def is_admin():
    """Mengecek apakah proses memiliki hak Administrator penuh."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False


def query_system_telemetry():
    """
    Menjalankan query telemetri terpadu ke PowerShell dengan flags CREATE_NO_WINDOW
    sehingga proses berlangsung instan (~1 detik) tanpa pernah membuka jendela CMD/console.
    Dilengkapi deteksi hak elevasi administrator & fallback instan agar tidak pernah freeze.
    """
    admin_mode = is_admin()

    if admin_mode:
        ps_code = """
        $ErrorActionPreference = 'SilentlyContinue'
        $disks = Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, Size, HealthStatus, SerialNumber, Model, FirmwareVersion
        if (-not $disks) {
            $disks = Get-CimInstance Win32_DiskDrive | Select-Object @{N='DeviceId';E={[string]$_.Index}}, @{N='FriendlyName';E={$_.Model}}, @{N='MediaType';E={if ($_.Model -match 'WD20|HDD|WDC') {'HDD'} else {'SSD'}}}, @{N='BusType';E={if ($_.Model -match 'NVMe|LEGEND') {'NVMe'} else {$_.InterfaceType}}}, Size, @{N='HealthStatus';E={$_.Status}}, @{N='SerialNumber';E={$_.SerialNumber}}, @{N='Model';E={$_.Model}}, @{N='FirmwareVersion';E={$_.FirmwareRevision}}
        }
        $parts = Get-Partition | Where-Object { $_.DriveLetter } | Select-Object DiskNumber, PartitionNumber, DriveLetter, Size
        $vols = Get-Volume | Where-Object { $_.DriveLetter } | Select-Object DriveLetter, FileSystemLabel, FileSystem, SizeRemaining, Size
        $smart = Get-CimInstance -Namespace 'root/wmi' -ClassName MSStorageDriver_ATAPISmartData -ErrorAction SilentlyContinue | Select-Object InstanceName, VendorSpecific
        $smartThresh = Get-CimInstance -Namespace 'root/wmi' -ClassName MSStorageDriver_FailurePredictThresholds -ErrorAction SilentlyContinue | Select-Object InstanceName, VendorSpecific
        $reliability = Get-PhysicalDisk | ForEach-Object { $c = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue; if ($c) { [pscustomobject]@{ DeviceId = [string]$_.DeviceId; Wear = $c.Wear; Temperature = $c.Temperature; PowerOnHours = $c.PowerOnHours; ReadErrorsTotal = $c.ReadErrorsTotal; WriteErrorsTotal = $c.WriteErrorsTotal; StartStopCycleCount = $c.StartStopCycleCount } } }
        @{ Disks = $disks; Partitions = $parts; Volumes = $vols; Smart = $smart; SmartThresh = $smartThresh; Reliability = $reliability; IsAdmin = $true } | ConvertTo-Json -Depth 4 -Compress
        """
        timeout_sec = 10
    else:
        # Non-admin fast path: Win32_DiskDrive & Win32_LogicalDisk (selalu terbuka & bebas hang < 0.4s)
        ps_code = """
        $ErrorActionPreference = 'SilentlyContinue'
        $disks = Get-CimInstance Win32_DiskDrive | Select-Object @{N='DeviceId';E={[string]$_.Index}}, @{N='FriendlyName';E={$_.Model}}, @{N='MediaType';E={if ($_.Model -match 'WD20|HDD|WDC') {'HDD'} else {'SSD'}}}, @{N='BusType';E={if ($_.Model -match 'NVMe|LEGEND') {'NVMe'} else {$_.InterfaceType}}}, Size, @{N='HealthStatus';E={$_.Status}}, @{N='SerialNumber';E={$_.SerialNumber}}, @{N='Model';E={$_.Model}}, @{N='FirmwareVersion';E={$_.FirmwareRevision}}
        $vols = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DeviceID } | Select-Object @{N='DriveLetter';E={$_.DeviceID.TrimEnd(':')}}, @{N='FileSystemLabel';E={$_.VolumeName}}, @{N='FileSystem';E={$_.FileSystem}}, @{N='SizeRemaining';E={$_.FreeSpace}}, Size
        $diskVolMap = foreach ($d in Get-CimInstance Win32_DiskDrive) {
            $parts = Get-CimAssociatedInstance -InputObject $d -ResultClassName Win32_DiskPartition -ErrorAction SilentlyContinue
            foreach ($p in $parts) {
                $volsForPart = Get-CimAssociatedInstance -InputObject $p -ResultClassName Win32_LogicalDisk -ErrorAction SilentlyContinue
                foreach ($v in $volsForPart) {
                    [pscustomobject]@{ DiskIndex = [string]$d.Index; DriveLetter = $v.DeviceID.TrimEnd(':') }
                }
            }
        }
        @{ Disks = $disks; Partitions = @(); Volumes = $vols; DiskVolMap = $diskVolMap; Smart = @(); SmartThresh = @(); Reliability = @(); IsAdmin = $false } | ConvertTo-Json -Depth 4 -Compress
        """
        timeout_sec = 5

    startupinfo = None
    creationflags = 0
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0  # SW_HIDE
        creationflags = 0x08000000  # CREATE_NO_WINDOW

    try:
        p = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_code],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            startupinfo=startupinfo,
            creationflags=creationflags,
        )
        if p.returncode == 0 and p.stdout.strip():
            return json.loads(p.stdout.strip())
    except Exception as e:
        print(f"Error querying telemetry (admin={admin_mode}): {e}")

    # Fallback darurat jika PowerShell timeout: coba fast CIM Win32_DiskDrive
    try:
        fast_code = "Get-CimInstance Win32_DiskDrive | Select-Object @{N='DeviceId';E={[string]$_.Index}}, @{N='FriendlyName';E={$_.Model}}, @{N='MediaType';E={'SSD'}}, @{N='BusType';E={$_.InterfaceType}}, Size, @{N='HealthStatus';E={$_.Status}}, @{N='SerialNumber';E={$_.SerialNumber}}, @{N='Model';E={$_.Model}} | ConvertTo-Json -Compress"
        p = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", fast_code],
            capture_output=True,
            text=True,
            timeout=3,
            startupinfo=startupinfo,
            creationflags=creationflags,
        )
        if p.returncode == 0 and p.stdout.strip():
            fallback_disks = json.loads(p.stdout.strip())
            if isinstance(fallback_disks, dict):
                fallback_disks = [fallback_disks]
            return {"Disks": fallback_disks, "Partitions": [], "Volumes": [], "Smart": [], "SmartThresh": [], "IsAdmin": admin_mode}
    except Exception:
        pass

    return {"Disks": [], "Partitions": [], "Volumes": [], "Smart": [], "SmartThresh": [], "IsAdmin": admin_mode}


def parse_smart_ini(ini_path, is_nvme=False):
    """
    Mengekstrak properti metrik dan atribut S.M.A.R.T lengkap dari Smart.ini
    sebagai fallback hardware cache yang selalu dapat diakses non-admin.
    """
    if not os.path.exists(ini_path):
        return {}, []
    try:
        with open(ini_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading ini {ini_path}: {e}")
        return {}, []

    sections = re.findall(r"\[(.*?)\]", content)
    main_sec = None
    thresh_sec = None
    for s in sections:
        if s.endswith("THRESHOLD"):
            thresh_sec = s
        elif not s.startswith("PC") and not s.endswith("FIRST"):
            main_sec = s

    props = {}
    if main_sec:
        m = re.search(rf"\[{re.escape(main_sec)}\](.*?)(?=\n\[|\Z)", content, re.DOTALL)
        if m:
            for line in m.group(1).strip().splitlines():
                if "=" in line:
                    k, v = line.split("=", 1)
                    props[k.strip()] = v.strip()

    thresholds = {}
    if thresh_sec:
        m = re.search(rf"\[{re.escape(thresh_sec)}\](.*?)(?=\n\[|\Z)", content, re.DOTALL)
        if m:
            for line in m.group(1).strip().splitlines():
                if "=" in line:
                    k, v = line.split("=", 1)
                    try:
                        thresholds[int(k.strip(), 16)] = int(v.strip())
                    except Exception:
                        pass

    # Bangun atribut S.M.A.R.T hanya dari nilai yang benar-benar ada di cache.
    attributes = []
    if is_nvme:
        def cached_int(key):
            value = props.get(key)
            try:
                return int(value) if value not in (None, "") else None
            except (TypeError, ValueError):
                return None

        poh = cached_int("PowerOnHours")
        poc = cached_int("PowerOnCount")
        temp = cached_int("Temperature")
        life = cached_int("Life")
        pct_used = max(0, 100 - life) if life is not None else None
        hw = cached_int("HostWrites")
        hr = cached_int("HostReads")
        unsafe = cached_int("UnsafeShutdowns")
        media_errors = cached_int("MediaErrors")

        nvme_specs = []
        if temp is not None:
            nvme_specs.append((0x02, "Composite Temperature", temp, f"0x{temp:012X}", None))
        if life is not None:
            nvme_specs.append((0x05, "Percentage Used", pct_used, f"0x{pct_used:012X}", None))
        if hr is not None:
            nvme_specs.append((0x06, "Data Units Read", hr * 2097152 // 512000, f"0x{hr:012X}", None))
        if hw is not None:
            nvme_specs.append((0x07, "Data Units Written", hw * 2097152 // 512000, f"0x{hw:012X}", None))
        if poc is not None:
            nvme_specs.append((0x0B, "Power Cycles", poc, f"0x{poc:012X}", None))
        if poh is not None:
            nvme_specs.append((0x0C, "Power On Hours", poh, f"0x{poh:012X}", None))
        if unsafe is not None:
            nvme_specs.append((0x0D, "Unsafe Shutdowns", unsafe, f"0x{unsafe:012X}", None))
        if media_errors is not None:
            nvme_specs.append((0x0E, "Media and Data Integrity Errors", media_errors, f"0x{media_errors:012X}", None))

        for aid, aname, val, raw_h, th in nvme_specs:
            meta = NVME_SMART_NAMES.get(aid, {})
            attributes.append({
                "id": aid,
                "id_hex": f"0x{aid:02X}",
                "name": aname,
                "desc_id": meta.get("desc_id", ""),
                "desc_en": meta.get("desc_en", ""),
                "current": None,
                "worst": None,
                "threshold": th,
                "raw_int": val,
                "raw_hex": raw_h,
            })
    else:
        for k, v in props.items():
            if re.match(r"^[0-9A-Fa-f]{2}$", k):
                aid = int(k, 16)
                cur_val = int(v) if v.isdigit() else None
                th = thresholds.get(aid, 0)

                raw_v = 0
                if aid == 0x05:
                    raw_v = int(props.get("ReallocatedSectorsCount", 0))
                elif aid == 0x09:
                    raw_v = int(props.get("PowerOnHours", 0))
                elif aid == 0x0C:
                    raw_v = int(props.get("PowerOnCount", 0))
                elif aid == 0xC2:
                    raw_v = int(props.get("Temperature", 0))
                elif aid == 0xC4:
                    raw_v = int(props.get("ReallocationEventCount", 0))
                elif aid == 0xF1:
                    raw_v = int(props.get("HostWrites", 0))
                elif aid == 0xF2:
                    raw_v = int(props.get("HostReads", 0))
                elif aid == 0xF9:
                    raw_v = int(props.get("NandWrites", 0))
                elif aid == 0xA9:
                    raw_v = int(props.get("Life", 0)) if str(props.get("Life", "")).strip().isdigit() else 0

                meta = ATA_SMART_NAMES.get(aid, {
                    "name": f"Vendor Specific (0x{aid:02X})",
                    "desc_id": "Atribut telemetri pabrikan disk.",
                    "desc_en": "Vendor specific hardware telemetry."
                })
                attributes.append({
                    "id": aid,
                    "id_hex": f"0x{aid:02X}",
                    "name": meta["name"],
                    "desc_id": meta["desc_id"],
                    "desc_en": meta["desc_en"],
                    "current": cur_val,
                    "worst": cur_val,
                    "threshold": th,
                    "raw_int": raw_v,
                    "raw_hex": f"0x{raw_v:012X}",
                })

    return props, attributes


def get_disk_hardware_cache():
    """Cari cache telemetri sistem lokal."""
    cache = {}
    if not os.path.exists(SMART_CACHE_DIR):
        return cache
    try:
        for entry in os.listdir(SMART_CACHE_DIR):
            full_path = os.path.join(SMART_CACHE_DIR, entry)
            if os.path.isdir(full_path):
                ini_file = os.path.join(full_path, "Smart.ini")
                if os.path.exists(ini_file):
                    is_nvme = "NVME" in entry.upper() or "LEGEND" in entry.upper()
                    props, attrs = parse_smart_ini(ini_file, is_nvme=is_nvme)
                    cache[entry] = {
                        "props": props,
                        "attrs": attrs,
                        "ini_path": ini_file,
                    }
    except Exception as e:
        print(f"Error scanning smart cache dir: {e}")
    return cache


def construct_disks_from_cache(cache_data):
    """Fallback deterministik membangun daftar disk langsung dari folder cache CrystalDiskInfo."""
    reconstructed = []
    idx = 0
    # Urutkan drive cache, abaikan drive eksternal yang dicabut jika ada
    for folder_name in sorted(cache_data.keys()):
        entry = cache_data[folder_name]
        name = folder_name
        serial = ""
        m = re.search(r"(2K\w+|2O\w+|WD-W\w+|1643\w+|AA\w+)$", folder_name)
        if m:
            serial = m.group(1)
            name = folder_name[:m.start()].strip()

        is_nvme = "NVME" in folder_name.upper() or "LEGEND" in folder_name.upper()
        is_hdd = "WD20" in folder_name.upper() or "WDC" in folder_name.upper() or "HDD" in folder_name.upper()
        media_type = "HDD" if is_hdd else "SSD"
        bus_type = "NVMe" if is_nvme else "SATA"

        # Ukuran tidak boleh ditebak dari nama model. Cache CDI tidak menyimpan kapasitas.
        size_bytes = 0

        reconstructed.append({
            "DeviceId": str(idx),
            "FriendlyName": name,
            "Model": name,
            "MediaType": media_type,
            "BusType": bus_type,
            "Size": size_bytes,
            "HealthStatus": "Healthy",
            "SerialNumber": serial,
            "_folder_name": folder_name
        })
        idx += 1
    return reconstructed


def _as_list(value):
    if isinstance(value, dict):
        return [value]
    return value if isinstance(value, list) else []


def _normalize_model(value):
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def _safe_int(value, default=None):
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _build_nvme_attributes(temp, poh, poc, percentage_used, host_writes, host_reads, unsafe, media_errors):
    specs = []
    if temp is not None:
        specs.append((0x02, "Composite Temperature", temp, f"0x{temp:012X}"))
    if percentage_used is not None:
        specs.append((0x05, "Percentage Used", percentage_used, f"0x{percentage_used:012X}"))
    if host_reads is not None:
        specs.append((0x06, "Data Units Read", host_reads * 2097152 // 512000, f"0x{host_reads:012X}"))
    if host_writes is not None:
        specs.append((0x07, "Data Units Written", host_writes * 2097152 // 512000, f"0x{host_writes:012X}"))
    if poc is not None:
        specs.append((0x0B, "Power Cycles", poc, f"0x{poc:012X}"))
    if poh is not None:
        specs.append((0x0C, "Power On Hours", poh, f"0x{poh:012X}"))
    if unsafe is not None:
        specs.append((0x0D, "Unsafe Shutdowns", unsafe, f"0x{unsafe:012X}"))
    if media_errors is not None:
        specs.append((0x0E, "Media and Data Integrity Errors", media_errors, f"0x{media_errors:012X}"))

    attributes = []
    for attr_id, attr_name, raw_value, raw_hex in specs:
        meta = NVME_SMART_NAMES.get(attr_id, {})
        attributes.append({
            "id": attr_id,
            "id_hex": f"0x{attr_id:02X}",
            "name": attr_name,
            "desc_id": meta.get("desc_id", ""),
            "desc_en": meta.get("desc_en", ""),
            "current": None,
            "worst": None,
            "threshold": None,
            "raw_int": raw_value,
            "raw_hex": raw_hex,
        })
    return attributes


def collect_all_disks_data():
    """Compile disk telemetry while preserving provenance for every reported value."""
    raw_telemetry = query_system_telemetry()
    raw_disks = _as_list(raw_telemetry.get("Disks"))
    raw_parts = _as_list(raw_telemetry.get("Partitions"))
    raw_vols = _as_list(raw_telemetry.get("Volumes"))
    raw_smart = _as_list(raw_telemetry.get("Smart"))
    raw_smart_thresh = _as_list(raw_telemetry.get("SmartThresh"))
    raw_reliability = _as_list(raw_telemetry.get("Reliability"))
    disk_vol_map = _as_list(raw_telemetry.get("DiskVolMap"))

    reliability_by_id = {}
    for entry in raw_reliability:
        if isinstance(entry, dict) and entry.get("DeviceId") is not None:
            reliability_by_id[str(entry.get("DeviceId"))] = entry

    vols_map = {}
    for volume in raw_vols:
        letter = volume.get("DriveLetter", "")
        size = volume.get("Size", 0) or 0
        free = volume.get("SizeRemaining", 0) or 0
        used = max(0, size - free)
        used_pct = round((used / size * 100), 1) if size > 0 else 0
        vols_map[letter] = {
            "drive_letter": letter,
            "label": volume.get("FileSystemLabel", "") or "",
            "file_system": volume.get("FileSystem", "") or "",
            "size_gb": round(size / (1024**3), 1),
            "free_gb": round(free / (1024**3), 1),
            "used_gb": round(used / (1024**3), 1),
            "used_pct": used_pct,
        }

    disk_vols = {}
    for partition in raw_parts:
        disk_no = str(partition.get("DiskNumber", ""))
        letter = partition.get("DriveLetter", "")
        if letter in vols_map:
            disk_vols.setdefault(disk_no, []).append(vols_map[letter])

    # Non-admin association map: only fill disks that have no partition mapping yet.
    for entry in disk_vol_map:
        if not isinstance(entry, dict):
            continue
        disk_no = str(entry.get("DiskIndex", ""))
        letter = entry.get("DriveLetter", "")
        if letter not in vols_map:
            continue
        existing = disk_vols.setdefault(disk_no, [])
        if all(v["drive_letter"] != letter for v in existing):
            existing.append(vols_map[letter])

    smart_wmi_dict = {}
    for smart in raw_smart:
        instance = smart.get("InstanceName", "")
        vendor_bytes = smart.get("VendorSpecific", [])
        if instance and vendor_bytes:
            smart_wmi_dict[instance] = vendor_bytes

    smart_wmi_thresh_dict = {}
    for smart in raw_smart_thresh:
        instance = smart.get("InstanceName", "")
        vendor_bytes = smart.get("VendorSpecific", [])
        if instance and vendor_bytes:
            smart_wmi_thresh_dict[instance] = vendor_bytes

    cache_data = get_disk_hardware_cache()
    if not raw_disks and cache_data:
        raw_disks = construct_disks_from_cache(cache_data)

    results = []
    admin_mode = is_admin()

    for disk in raw_disks:
        device_id = str(disk.get("DeviceId", ""))
        name = disk.get("FriendlyName", "") or disk.get("Model", "Unknown Disk")
        media_type = disk.get("MediaType", "SSD") or "SSD"
        bus_type = disk.get("BusType", "SATA") or "SATA"
        serial = disk.get("SerialNumber", "") or ""
        firmware = disk.get("FirmwareVersion", "") or disk.get("FirmwareRevision", "") or ""
        size_bytes = disk.get("Size", 0) or 0
        size_gb = round(size_bytes / (1024**3), 1) if size_bytes else None

        volumes = disk_vols.get(device_id, [])
        drive_letters = [v["drive_letter"] for v in volumes]
        drive_letters_str = ", ".join(f"{letter}:" for letter in drive_letters) if drive_letters else "-"

        matched_cache_entry = {}
        normalized_name = _normalize_model(name)
        for folder_name, entry_data in cache_data.items():
            normalized_folder = _normalize_model(folder_name)
            if (normalized_name and normalized_name in normalized_folder) or (serial and serial in folder_name):
                matched_cache_entry = entry_data
                break

        matched_props = matched_cache_entry.get("props", {}) if matched_cache_entry else {}
        cached_attrs = matched_cache_entry.get("attrs", []) if matched_cache_entry else []
        cache_date = matched_props.get("Date") if matched_props else None

        reliability = reliability_by_id.get(device_id, {})

        cache_life = _safe_int(matched_props.get("Life"))
        cache_temp = _safe_int(matched_props.get("Temperature"))
        cache_poh = _safe_int(matched_props.get("PowerOnHours"))
        cache_poc = _safe_int(matched_props.get("PowerOnCount"))
        cache_host_writes = _safe_int(matched_props.get("HostWrites"))
        cache_host_reads = _safe_int(matched_props.get("HostReads"))
        reliability_temp = _safe_int(reliability.get("Temperature"))
        reliability_poh = _safe_int(reliability.get("PowerOnHours"))
        reliability_poc = _safe_int(reliability.get("StartStopCycleCount"))
        reliability_wear = _safe_int(reliability.get("Wear"))

        is_nvme = "NVME" in bus_type.upper() or "NVME" in name.upper()
        smart_attributes = []
        data_source = "unavailable"

        if is_nvme:
            cache_temp = cache_temp if cache_temp is not None else reliability_temp
            cache_poh = cache_poh if cache_poh is not None else reliability_poh
            cache_poc = cache_poc if cache_poc is not None else reliability_poc
            cache_percentage_used = max(0, 100 - cache_life) if cache_life is not None else None
            percentage_used = reliability_wear
            if percentage_used is None:
                percentage_used = cache_percentage_used
            elif cache_percentage_used is not None:
                # Never under-report wear: some controllers return 0 from the
                # Windows reliability counter while their own log reports usage.
                percentage_used = max(percentage_used, cache_percentage_used)
            available_spare = _safe_int(matched_props.get("AvailableSpare"))
            unsafe_shutdowns = _safe_int(matched_props.get("UnsafeShutdowns"))
            media_errors = _safe_int(matched_props.get("MediaErrors"))

            if reliability_wear is not None or reliability_poh is not None:
                data_source = "live-wmi"
            elif cache_life is not None or cache_temp is not None:
                data_source = "cdi-cache"

            nvme_meta = {
                "percentage_used": percentage_used,
                "available_spare": available_spare,
                "host_writes": cache_host_writes,
                "host_reads": cache_host_reads,
                "unsafe_shutdowns": unsafe_shutdowns,
                "media_errors": media_errors,
            }
            primary_vol = volumes[0] if volumes else {}
            health_analysis = calculate_nvme_true_health(
                name, nvme_meta, cache_poh, primary_vol, data_source=data_source
            )
            smart_attributes = cached_attrs or _build_nvme_attributes(
                cache_temp,
                cache_poh,
                cache_poc,
                percentage_used,
                cache_host_writes,
                cache_host_reads,
                unsafe_shutdowns,
                media_errors,
            )
            temp = cache_temp
            poh = cache_poh
            poc = cache_poc
        else:
            matched_wmi_bytes = []
            matched_wmi_thresh = []
            skip_tokens = {"SSD", "NVME", "DISK", "SATA", "DRIVE", "WINDOWS"}
            model_tokens = [
                token for token in re.split(r"[^A-Za-z0-9]+", name.upper())
                if len(token) >= 4 and token not in skip_tokens
            ]
            for instance, vendor_bytes in smart_wmi_dict.items():
                normalized_instance = _normalize_model(instance)
                if model_tokens and any(token in normalized_instance for token in model_tokens):
                    matched_wmi_bytes = vendor_bytes
                    matched_wmi_thresh = smart_wmi_thresh_dict.get(instance, [])
                    break

            if matched_wmi_bytes:
                smart_attributes = decode_ata_smart_table(matched_wmi_bytes, matched_wmi_thresh)
                data_source = "live-wmi"
            elif cached_attrs:
                smart_attributes = cached_attrs
                data_source = "cdi-cache"

            attr_map = {a.get("id"): a for a in smart_attributes}
            attr_temp = _safe_int(attr_map.get(0xC2, {}).get("raw_int"))
            attr_poh = _safe_int(attr_map.get(0x09, {}).get("raw_int"))
            attr_poc = _safe_int(attr_map.get(0x0C, {}).get("raw_int"))
            temp = attr_temp if attr_temp is not None else cache_temp
            temp = temp if temp is not None else reliability_temp
            poh = attr_poh if attr_poh is not None else cache_poh
            poh = poh if poh is not None else reliability_poh
            poc = attr_poc if attr_poc is not None else cache_poc
            poc = poc if poc is not None else reliability_poc

            is_mechanical = (
                "HDD" in media_type.upper()
                or "HDD" in name.upper()
                or "WDC" in name.upper()
                or "WD20" in name.upper()
            )
            if is_mechanical:
                health_analysis = calculate_hdd_health(smart_attributes, poh, temp, data_source=data_source)
            else:
                health_analysis = calculate_sata_true_health(
                    name, smart_attributes, poh, cache_life, data_source=data_source
                )

        hw_profile = detect_hardware_profile(name, media_type, bus_type, size_gb or 0, smart_attributes)

        results.append({
            "device_id": device_id,
            "name": name,
            "media_type": media_type,
            "bus_type": bus_type,
            "serial_number": serial,
            "firmware": firmware,
            "size_gb": size_gb,
            "drive_letters": drive_letters,
            "drive_letters_str": drive_letters_str,
            "volumes": volumes,
            "temperature_c": temp,
            "power_on_hours": poh,
            "power_on_count": poc,
            "health_analysis": health_analysis,
            "smart_attributes": smart_attributes,
            "hardware_profile": hw_profile,
            "data_source": data_source,
            "data_source_date": cache_date,
            "data_gaps": health_analysis.get("data_gaps", []),
            "is_admin": admin_mode,
        })

    return results


if __name__ == "__main__":
    disks = collect_all_disks_data()
    print(f"Collected {len(disks)} disks in single silent pass!")
    for d in disks:
        ha = d["health_analysis"]
        attrs = d.get("smart_attributes", [])
        print(f"- [{d['drive_letters_str']}] {d['name']}: True={ha.get('true_health')}%, SMART Attrs={len(attrs)}")
