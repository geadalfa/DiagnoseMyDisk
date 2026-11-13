"""
health_engine.py
Deterministic storage health evaluation built only from evidence that was
actually read from the drive or its local telemetry cache.

Design rule: when a value is unavailable, report it as unavailable. Never
substitute a plausible-looking number, because a diagnostic tool that invents
telemetry is worse than one that admits a gap.
"""


def _num(value):
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _pct(value):
    value = _num(value)
    if value is None or value < 0 or value > 100:
        return None
    return value


def _health_status(true_health):
    if true_health is None:
        return {
            "status_label_id": "Tidak Diketahui",
            "status_label_en": "Unknown",
            "status_badge_color": "zinc",
        }
    if true_health >= 90:
        return {
            "status_label_id": "Sangat Prima",
            "status_label_en": "Excellent",
            "status_badge_color": "emerald",
        }
    if true_health >= 75:
        return {
            "status_label_id": "Normal (Perlu Pantauan)",
            "status_label_en": "Good (Needs Monitoring)",
            "status_badge_color": "amber",
        }
    return {
        "status_label_id": "Perhatian",
        "status_label_en": "Caution",
        "status_badge_color": "rose",
    }


def _source_note(data_source):
    if data_source == "live-wmi":
        return {
            "id": "Sumber: register S.M.A.R.T live via Windows WMI/CIM.",
            "en": "Source: live S.M.A.R.T registers via Windows WMI/CIM.",
        }
    if data_source == "cdi-cache":
        return {
            "id": "Sumber: cache CrystalDiskInfo lokal (data historis, bukan pembacaan live).",
            "en": "Source: local CrystalDiskInfo cache (historical snapshot, not a live read).",
        }
    if data_source == "windows-health":
        return {
            "id": "Sumber: status kesehatan perangkat dari Windows. Register S.M.A.R.T mentah tidak diekspos oleh driver.",
            "en": "Source: Windows device health status. Raw S.M.A.R.T registers are not exposed by the driver.",
        }
    return {
        "id": "Sumber: telemetri drive tidak tersedia.",
        "en": "Source: drive telemetry is unavailable.",
    }



def _unavailable_note(data_source):
    """Explain a missing health score without blaming the user for a driver limit."""
    if data_source == "windows-health":
        return {
            "id": "Windows melaporkan status kesehatan perangkat. Register S.M.A.R.T mentah tidak diekspos oleh driver, jadi angka keausan tidak dihitung.",
            "en": "Windows reports the device health status. Raw S.M.A.R.T registers are not exposed by the driver, so no wear percentage is calculated.",
        }
    return {
        "id": "Register mentah dan snapshot cache tidak tersedia. Jalankan aplikasi sebagai Administrator atau buka drive dengan alat pembaca S.M.A.R.T.",
        "en": "Raw registers and cached snapshots are unavailable. Run as Administrator or read the drive with a S.M.A.R.T-capable tool.",
    }

def calculate_sata_true_health(model_name, attributes, power_on_hours=0, cdi_life=None, data_source="live-wmi"):
    """Evaluate a SATA SSD from real S.M.A.R.T attributes and/or a CDI health snapshot."""
    attributes = attributes or []
    attr_map = {a.get("id"): a for a in attributes if isinstance(a, dict)}

    def raw(attr_id):
        return _num(attr_map.get(attr_id, {}).get("raw_int"))

    reallocated = raw(0x05) or 0
    pending = raw(0xC5) or 0
    uncorrectable = raw(0xC6) or 0
    crc_errors = raw(0xC7) or 0
    bad_blocks = raw(0xA6) or 0
    power_loss = raw(0xAE) or 0
    host_writes = raw(0xF1) or 0
    host_reads = raw(0xF2) or 0
    nand_writes = raw(0xF9) or raw(0xFA) or raw(0xE9) or 0
    avg_erase = raw(0xA4) or 0
    max_pe = raw(0xA3) or 0
    raw_health = _pct(raw(0xA9))
    if raw_health == 0:
        # Several controllers expose 0 in 0xA9 when the raw counter is not
        # populated. Treat it as missing instead of declaring the drive dead.
        raw_health = None
    available_spare = _pct(raw(0xE8))
    cdi_life = _pct(cdi_life)
    power_on_hours = _num(power_on_hours) or 0

    locked_ids = [attr_id for attr_id in (0x05, 0xA9, 0xE8) if attr_id in attr_map]
    firmware_current_locked = bool(locked_ids) and all(
        _num(attr_map[attr_id].get("current")) == 100 for attr_id in locked_ids
    )

    data_gaps = []
    if raw_health is None:
        data_gaps.append("0xA9 Remaining Life raw value")
    if available_spare is None:
        data_gaps.append("0xE8 Available Reserved Space")
    if not attributes:
        data_gaps.append("raw S.M.A.R.T attribute table")
    if power_on_hours <= 0:
        data_gaps.append("Power-On Hours")
    if host_writes <= 0:
        data_gaps.append("Host Writes")

    base_health = None
    basis = None
    if raw_health is not None:
        base_health = raw_health
        basis = "0xA9 Remaining Life (raw register)"
    elif cdi_life is not None:
        base_health = cdi_life
        basis = "CrystalDiskInfo health snapshot"
    elif avg_erase > 0 and max_pe > 0:
        base_health = max(0, int(100 - (avg_erase / max_pe) * 100))
        basis = "Average erase count vs rated P/E cycles"

    penalty = 0.0
    if reallocated > 0:
        penalty += min(12.0, 1.0 + reallocated / 16.0)
    if pending > 0:
        penalty += min(15.0, pending * 2.0)
    if uncorrectable > 0:
        penalty += min(20.0, uncorrectable * 4.0)

    true_health = None
    if base_health is not None:
        true_health = int(max(1, min(100, round(base_health - penalty))))

    reported_health = cdi_life
    if reported_health is None and firmware_current_locked:
        reported_health = 100

    is_masking = bool(
        firmware_current_locked
        and true_health is not None
        and true_health < 95
        and (reported_health is None or reported_health >= 95)
    )

    masking_explanation_id = None
    masking_explanation_en = None
    if is_masking:
        masking_explanation_id = (
            f"Firmware {model_name} melaporkan nilai normalisasi 'Current' = 100 untuk atribut kunci, "
            f"tetapi register mentah menunjukkan sisa kesehatan {true_health}% "
            f"(basis: {basis}). Alat yang hanya membaca kolom Current akan melewatkan degradasi ini."
        )
        masking_explanation_en = (
            f"The {model_name} firmware reports normalized 'Current' = 100 for key attributes, "
            f"while raw registers indicate {true_health}% remaining health "
            f"(basis: {basis}). Tools that only read the Current column will miss this degradation."
        )
    elif firmware_current_locked and true_health is not None:
        masking_explanation_id = (
            f"Firmware mengunci kolom Current di 100, tetapi kesehatan sebenarnya dihitung dari "
            f"{basis} sebesar {true_health}%. Ini bukan klaim '100% good'."
        )
        masking_explanation_en = (
            f"Firmware locks the Current column at 100, but true health computed from "
            f"{basis} is {true_health}%. This is not a '100% good' claim."
        )

    layman_factors = []
    if power_on_hours > 0:
        layman_factors.append({
            "title_id": f"Jam Terbang {power_on_hours:,} Jam",
            "title_en": f"Power-On Time {power_on_hours:,} Hours",
            "desc_id": f"Drive aktif selama {power_on_hours:,} jam (sekitar {round(power_on_hours / 8760, 1)} tahun).",
            "desc_en": f"Drive has been powered on for {power_on_hours:,} hours (~{round(power_on_hours / 8760, 1)} years).",
            "severity": "info",
        })
    if host_writes > 0:
        layman_factors.append({
            "title_id": f"Beban Penulisan {host_writes:,} GB",
            "title_en": f"Host Writes {host_writes:,} GB",
            "desc_id": f"Total data yang ditulis host sekitar {round(host_writes / 1024, 1)} TB.",
            "desc_en": f"Total host data written is approximately {round(host_writes / 1024, 1)} TB.",
            "severity": "info",
        })
    if reallocated > 0:
        layman_factors.append({
            "title_id": f"{reallocated:,} Sektor Direlokasi",
            "title_en": f"{reallocated:,} Reallocated Sectors",
            "desc_id": f"{reallocated:,} sektor rusak telah dipindahkan ke area cadangan. Pantau apakah jumlahnya bertambah.",
            "desc_en": f"{reallocated:,} damaged sectors were remapped to the spare area. Monitor whether the count keeps growing.",
            "severity": "warning",
        })
    if pending > 0 or uncorrectable > 0:
        layman_factors.append({
            "title_id": f"Sektor Pending {pending:,} / Uncorrectable {uncorrectable:,}",
            "title_en": f"Pending {pending:,} / Uncorrectable {uncorrectable:,} Sectors",
            "desc_id": "Sektor tidak stabil atau tidak dapat dikoreksi terdeteksi. Segera cadangkan data penting.",
            "desc_en": "Unstable or uncorrectable sectors detected. Back up important data immediately.",
            "severity": "danger" if uncorrectable > 0 else "warning",
        })
    if available_spare is not None and available_spare < 100:
        layman_factors.append({
            "title_id": f"Cadangan Blok {available_spare}%",
            "title_en": f"Spare Blocks {available_spare}%",
            "desc_id": f"Ruang blok cadangan tersisa {available_spare}% menurut register 0xE8.",
            "desc_en": f"Remaining spare block capacity is {available_spare}% according to register 0xE8.",
            "severity": "warning" if available_spare < 20 else "info",
        })
    if power_loss > 0:
        layman_factors.append({
            "title_id": f"{power_loss:,} Kali Mati Mendadak",
            "title_en": f"{power_loss:,} Unexpected Power Losses",
            "desc_id": "Tercatat pemutusan daya tanpa shutdown normal. Gunakan UPS bila sering terjadi.",
            "desc_en": "Power cuts without a graceful shutdown were recorded. Consider a UPS if this recurs.",
            "severity": "warning",
        })
    if true_health is None:
        layman_factors.append({
            "title_id": "Data Kesehatan Belum Tersedia",
            "title_en": "Health Data Unavailable",
            "desc_id": _unavailable_note(data_source)["id"],
            "desc_en": _unavailable_note(data_source)["en"],
            "severity": "warning",
        })

    waf = round(nand_writes / host_writes, 2) if host_writes > 0 and nand_writes > 0 else None
    technical_factors_id = [
        f"Basis perhitungan: {basis or 'tidak tersedia (tidak ada register mentah/cache)'}.",
        (
            "Nilai normalisasi Current untuk atribut kunci terkunci di 100 oleh firmware; "
            "kesehatan dihitung dari nilai raw, bukan kolom Current."
            if firmware_current_locked
            else "Kolom Current tidak digunakan sebagai dasar kesehatan; nilai raw dan cache yang dipakai."
        ),
        f"0x05 Reallocated Sectors: {reallocated:,}; 0xC5 Pending: {pending:,}; 0xC6 Uncorrectable: {uncorrectable:,}; 0xC7 CRC: {crc_errors:,}.",
        f"0xA6 Bad Blocks: {bad_blocks:,}; 0xAE Unexpected Power Loss: {power_loss:,}.",
        f"0xE8 Available Reserved Space: {available_spare if available_spare is not None else 'N/A'}; "
        f"0xA9 Remaining Life raw: {raw_health if raw_health is not None else 'N/A'}.",
        f"Host Writes: {host_writes:,} GB; NAND Writes: {nand_writes:,} GB; WAF: {waf if waf is not None else 'N/A'}.",
        f"Average erase: {avg_erase:,}; rated max P/E: {max_pe:,}.",
        _source_note(data_source)["id"],
    ]
    technical_factors_en = [
        f"Calculation basis: {basis or 'unavailable (no raw registers or cache snapshot)'}.",
        (
            "Normalized Current values for key attributes are locked at 100 by firmware; "
            "health is derived from raw values, not the Current column."
            if firmware_current_locked
            else "The Current column is not used as the health basis; raw values and cache snapshots are used instead."
        ),
        f"0x05 Reallocated Sectors: {reallocated:,}; 0xC5 Pending: {pending:,}; 0xC6 Uncorrectable: {uncorrectable:,}; 0xC7 CRC: {crc_errors:,}.",
        f"0xA6 Bad Blocks: {bad_blocks:,}; 0xAE Unexpected Power Loss: {power_loss:,}.",
        f"0xE8 Available Reserved Space: {available_spare if available_spare is not None else 'N/A'}; "
        f"0xA9 Remaining Life raw: {raw_health if raw_health is not None else 'N/A'}.",
        f"Host Writes: {host_writes:,} GB; NAND Writes: {nand_writes:,} GB; WAF: {waf if waf is not None else 'N/A'}.",
        f"Average erase: {avg_erase:,}; rated max P/E: {max_pe:,}.",
        _source_note(data_source)["en"],
    ]

    result = {
        "reported_health": reported_health,
        "true_health": true_health,
        "is_masking": is_masking,
        "firmware_current_locked": firmware_current_locked,
        "masking_explanation_id": masking_explanation_id,
        "masking_explanation_en": masking_explanation_en,
        "layman_factors": layman_factors,
        "technical_factors_id": technical_factors_id,
        "technical_factors_en": technical_factors_en,
        "data_gaps": data_gaps,
        "data_source": data_source,
        "metrics": {
            "reallocated_sectors": reallocated,
            "pending_sectors": pending,
            "uncorrectable_sectors": uncorrectable,
            "crc_errors": crc_errors,
            "bad_blocks": bad_blocks,
            "available_spare_pct": available_spare,
            "power_loss_events": power_loss,
            "host_writes_gb": host_writes,
            "host_reads_gb": host_reads,
            "nand_writes_gb": nand_writes,
            "waf": waf,
            "avg_erase_cycles": avg_erase,
            "max_pe_cycles": max_pe,
            "host_writes_tb": round(host_writes / 1024, 2) if host_writes else None,
            "host_reads_tb": round(host_reads / 1024, 2) if host_reads else None,
            "basis": basis,
        },
    }
    result.update(_health_status(true_health))
    return result


def calculate_nvme_true_health(model_name, cdi_smart_data, power_on_hours, vol_info, data_source="live-wmi"):
    """Evaluate NVMe health from NVM Express Log Page 02h values that are actually present."""
    cdi_smart_data = cdi_smart_data or {}
    percentage_used = _pct(cdi_smart_data.get("percentage_used"))
    available_spare = _pct(cdi_smart_data.get("available_spare"))
    host_writes_gb = _num(cdi_smart_data.get("host_writes"))
    host_reads_gb = _num(cdi_smart_data.get("host_reads"))
    unsafe_shutdowns = _num(cdi_smart_data.get("unsafe_shutdowns"))
    media_errors = _num(cdi_smart_data.get("media_errors"))
    power_on_hours = _num(power_on_hours) or 0
    vol_info = vol_info or {}
    used_pct = vol_info.get("used_pct")
    free_gb = vol_info.get("free_gb")

    true_health = None
    if percentage_used is not None:
        true_health = int(max(0, min(100, 100 - percentage_used)))
        if available_spare is not None and available_spare < 10:
            true_health = int(max(0, true_health - (10 - available_spare)))

    data_gaps = []
    if percentage_used is None:
        data_gaps.append("Percentage Used (NVMe Log Page 02h)")
    if available_spare is None:
        data_gaps.append("Available Spare")
    if host_writes_gb is None:
        data_gaps.append("Data Units Written")
    if unsafe_shutdowns is None:
        data_gaps.append("Unsafe Shutdowns")
    if media_errors is None:
        data_gaps.append("Media Integrity Errors")

    layman_factors = []
    if percentage_used is not None:
        layman_factors.append({
            "title_id": f"Konsumsi Masa Pakai {percentage_used}%",
            "title_en": f"Life Consumed {percentage_used}%",
            "desc_id": f"SSD telah memakai {percentage_used}% dari estimasi masa pakai, menyisakan {true_health}%.",
            "desc_en": f"Drive has consumed {percentage_used}% of its endurance estimate, leaving {true_health}%.",
            "severity": "info" if percentage_used < 80 else "warning",
        })
    if host_writes_gb is not None:
        layman_factors.append({
            "title_id": f"Penulisan Host {host_writes_gb:,} GB",
            "title_en": f"Host Writes {host_writes_gb:,} GB",
            "desc_id": f"Total data yang ditulis host sekitar {round(host_writes_gb / 1024, 2)} TB.",
            "desc_en": f"Total host data written is approximately {round(host_writes_gb / 1024, 2)} TB.",
            "severity": "info",
        })
    if available_spare is not None:
        layman_factors.append({
            "title_id": f"Available Spare {available_spare}%",
            "title_en": f"Available Spare {available_spare}%",
            "desc_id": f"Cadangan blok fisik tersisa {available_spare}%.",
            "desc_en": f"Remaining physical spare capacity is {available_spare}%.",
            "severity": "success" if available_spare >= 50 else "warning",
        })
    if unsafe_shutdowns is not None and unsafe_shutdowns > 0:
        layman_factors.append({
            "title_id": f"{unsafe_shutdowns:,} Unsafe Shutdowns",
            "title_en": f"{unsafe_shutdowns:,} Unsafe Shutdowns",
            "desc_id": "Tercatat pemutusan daya tanpa shutdown normal.",
            "desc_en": "Power loss events without a graceful shutdown were recorded.",
            "severity": "warning",
        })
    if media_errors is not None and media_errors > 0:
        layman_factors.append({
            "title_id": f"{media_errors:,} Media Integrity Errors",
            "title_en": f"{media_errors:,} Media Integrity Errors",
            "desc_id": "Controller mencatat error integritas media. Periksa kesehatan data dan cadangan.",
            "desc_en": "The controller logged media integrity errors. Verify data integrity and backups.",
            "severity": "danger",
        })
    if used_pct is not None and used_pct >= 85:
        layman_factors.append({
            "title_id": f"Volume Terisi {used_pct}%",
            "title_en": f"Volume {used_pct}% Full",
            "desc_id": "Ruang tersisa sempit sehingga garbage collection lebih agresif.",
            "desc_en": "Tight free space forces more aggressive garbage collection.",
            "severity": "warning",
        })
    if true_health is None:
        layman_factors.append({
            "title_id": "Data Kesehatan NVMe Belum Tersedia",
            "title_en": "NVMe Health Data Unavailable",
            "desc_id": _unavailable_note(data_source)["id"],
            "desc_en": _unavailable_note(data_source)["en"],
            "severity": "warning",
        })

    technical_factors_id = [
        f"NVMe Log Page 02h: Percentage Used = {percentage_used if percentage_used is not None else 'N/A'}%.",
        f"Health = 100 - Percentage Used (dengan penalti spare rendah bila ada) = "
        f"{true_health if true_health is not None else 'N/A'}%.",
        f"Available Spare = {available_spare if available_spare is not None else 'N/A'}%; "
        f"Unsafe Shutdowns = {unsafe_shutdowns if unsafe_shutdowns is not None else 'N/A'}; "
        f"Media Errors = {media_errors if media_errors is not None else 'N/A'}.",
        f"Power-On Hours = {power_on_hours:,}; Host Writes = {host_writes_gb if host_writes_gb is not None else 'N/A'} GB.",
        _source_note(data_source)["id"],
    ]
    technical_factors_en = [
        f"NVMe Log Page 02h: Percentage Used = {percentage_used if percentage_used is not None else 'N/A'}%.",
        f"Health = 100 - Percentage Used (plus low-spare penalty when applicable) = "
        f"{true_health if true_health is not None else 'N/A'}%.",
        f"Available Spare = {available_spare if available_spare is not None else 'N/A'}%; "
        f"Unsafe Shutdowns = {unsafe_shutdowns if unsafe_shutdowns is not None else 'N/A'}; "
        f"Media Errors = {media_errors if media_errors is not None else 'N/A'}.",
        f"Power-On Hours = {power_on_hours:,}; Host Writes = {host_writes_gb if host_writes_gb is not None else 'N/A'} GB.",
        _source_note(data_source)["en"],
    ]

    masking_explanation_id = (
        "NVMe tidak memakai masking normalisasi ATA. Kesehatan dihitung dari Percentage Used; "
        "nilai yang tidak tersedia dilaporkan sebagai N/A, bukan angka rekaan."
    )
    masking_explanation_en = (
        "NVMe does not use ATA normalized-value masking. Health is derived from Percentage Used; "
        "unavailable values are reported as N/A instead of fabricated numbers."
    )

    result = {
        "reported_health": true_health,
        "true_health": true_health,
        "is_masking": False,
        "firmware_current_locked": False,
        "masking_explanation_id": masking_explanation_id,
        "masking_explanation_en": masking_explanation_en,
        "layman_factors": layman_factors,
        "technical_factors_id": technical_factors_id,
        "technical_factors_en": technical_factors_en,
        "data_gaps": data_gaps,
        "data_source": data_source,
        "metrics": {
            "percentage_used": percentage_used,
            "available_spare_pct": available_spare,
            "unsafe_shutdowns": unsafe_shutdowns,
            "media_errors": media_errors,
            "host_writes_gb": host_writes_gb,
            "host_reads_gb": host_reads_gb,
            "host_writes_tb": round(host_writes_gb / 1024, 2) if host_writes_gb is not None else None,
            "host_reads_tb": round(host_reads_gb / 1024, 2) if host_reads_gb is not None else None,
            "used_pct": used_pct,
            "free_gb": free_gb,
        },
    }
    result.update(_health_status(true_health))
    return result


def calculate_hdd_health(attributes, power_on_hours=0, temperature=None, data_source="live-wmi"):
    """Evaluate a mechanical HDD from real ATA attributes instead of a fixed 'Excellent' label."""
    attributes = attributes or []
    attr_map = {a.get("id"): a for a in attributes if isinstance(a, dict)}

    def raw(attr_id):
        return _num(attr_map.get(attr_id, {}).get("raw_int"))

    reallocated = raw(0x05) or 0
    pending = raw(0xC5) or 0
    uncorrectable = raw(0xC6) or 0
    crc_errors = raw(0xC7) or 0
    spin_retry = raw(0x0A) or 0
    temp_value = temperature if temperature is not None else raw(0xC2)
    power_on_hours = _num(power_on_hours) or 0

    penalty = 0.0
    if reallocated > 0:
        penalty += min(30.0, reallocated * 1.5)
    if pending > 0:
        penalty += min(30.0, pending * 2.0)
    if uncorrectable > 0:
        penalty += min(30.0, uncorrectable * 3.0)
    if spin_retry > 0:
        penalty += min(15.0, spin_retry * 3.0)

    true_health = None
    if attributes:
        true_health = int(max(1, min(100, round(100 - penalty))))

    data_gaps = []
    if not attributes:
        data_gaps.append("raw S.M.A.R.T attribute table")
    if power_on_hours <= 0:
        data_gaps.append("Power-On Hours")
    if temp_value is None:
        data_gaps.append("Temperature")

    layman_factors = []
    if power_on_hours > 0:
        layman_factors.append({
            "title_id": f"Jam Terbang {power_on_hours:,} Jam",
            "title_en": f"Power-On Time {power_on_hours:,} Hours",
            "desc_id": f"HDD aktif selama {power_on_hours:,} jam (sekitar {round(power_on_hours / 8760, 1)} tahun).",
            "desc_en": f"HDD has been powered on for {power_on_hours:,} hours (~{round(power_on_hours / 8760, 1)} years).",
            "severity": "info",
        })
    if temp_value is not None:
        layman_factors.append({
            "title_id": f"Suhu {temp_value}°C",
            "title_en": f"Temperature {temp_value}°C",
            "desc_id": "Suhu operasional dalam batas normal." if temp_value <= 45 else "Suhu di atas 45°C; periksa aliran udara casing.",
            "desc_en": "Operating temperature is within the normal range." if temp_value <= 45 else "Temperature above 45°C; check case airflow.",
            "severity": "success" if temp_value <= 45 else "warning",
        })
    if reallocated or pending or uncorrectable:
        layman_factors.append({
            "title_id": "Sektor Bermasalah Terdeteksi",
            "title_en": "Problem Sectors Detected",
            "desc_id": f"Reallocated {reallocated:,}, Pending {pending:,}, Uncorrectable {uncorrectable:,}. Cadangkan data penting sekarang.",
            "desc_en": f"Reallocated {reallocated:,}, Pending {pending:,}, Uncorrectable {uncorrectable:,}. Back up important data now.",
            "severity": "danger",
        })
    elif attributes:
        layman_factors.append({
            "title_id": "Permukaan Piringan Bersih",
            "title_en": "Clean Platter Surface",
            "desc_id": "Tidak ada sektor reallocated, pending, maupun uncorrectable pada pembacaan ini.",
            "desc_en": "No reallocated, pending, or uncorrectable sectors were reported in this read.",
            "severity": "success",
        })
    if crc_errors > 0:
        layman_factors.append({
            "title_id": f"{crc_errors:,} UltraDMA CRC Error",
            "title_en": f"{crc_errors:,} UltraDMA CRC Errors",
            "desc_id": "Riwayat error komunikasi kabel SATA. Periksa kabel dan konektor bila jumlahnya bertambah.",
            "desc_en": "History of SATA cable communication errors. Check the cable and connectors if the count grows.",
            "severity": "warning",
        })
    if true_health is None:
        layman_factors.append({
            "title_id": "Data Kesehatan HDD Belum Tersedia",
            "title_en": "HDD Health Data Unavailable",
            "desc_id": _unavailable_note(data_source)["id"],
            "desc_en": _unavailable_note(data_source)["en"],
            "severity": "warning",
        })

    technical_factors_id = [
        f"0x05 Reallocated: {reallocated:,}; 0xC5 Pending: {pending:,}; 0xC6 Uncorrectable: {uncorrectable:,}; "
        f"0xC7 CRC: {crc_errors:,}; 0x0A Spin Retry: {spin_retry:,}.",
        f"Power-On Hours: {power_on_hours:,}; Temperature: {temp_value if temp_value is not None else 'N/A'}°C.",
        _source_note(data_source)["id"],
    ]
    technical_factors_en = [
        f"0x05 Reallocated: {reallocated:,}; 0xC5 Pending: {pending:,}; 0xC6 Uncorrectable: {uncorrectable:,}; "
        f"0xC7 CRC: {crc_errors:,}; 0x0A Spin Retry: {spin_retry:,}.",
        f"Power-On Hours: {power_on_hours:,}; Temperature: {temp_value if temp_value is not None else 'N/A'}°C.",
        _source_note(data_source)["en"],
    ]

    result = {
        "reported_health": None,
        "true_health": true_health,
        "is_masking": False,
        "firmware_current_locked": False,
        "masking_explanation_id": "HDD mekanikal tidak memakai normalisasi kesehatan firmware seperti SSD; "
                                  "evaluasi dihitung dari sektor bermasalah yang benar-benar dilaporkan.",
        "masking_explanation_en": "Mechanical HDDs do not use SSD-style firmware health normalization; "
                                  "this evaluation uses the problem-sector counters actually reported.",
        "layman_factors": layman_factors,
        "technical_factors_id": technical_factors_id,
        "technical_factors_en": technical_factors_en,
        "data_gaps": data_gaps,
        "data_source": data_source,
        "metrics": {
            "reallocated_sectors": reallocated,
            "pending_sectors": pending,
            "uncorrectable_sectors": uncorrectable,
            "crc_errors": crc_errors,
            "spin_retry_count": spin_retry,
            "temperature_c": temp_value,
        },
    }
    result.update(_health_status(true_health))
    return result
