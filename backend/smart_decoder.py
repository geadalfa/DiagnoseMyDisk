"""
smart_decoder.py
Decoder dan Mesin Analisis Telemetri S.M.A.R.T Mendalam (DiagnoseMyDisk)
Mendeteksi kesehatan sebenarnya pada SATA SSD, NVMe, dan HDD mekanikal,
serta mengoreksi anomali pelaporan firmware tanpa manipulasi nilai.
"""

ATA_SMART_NAMES = {
    0x01: {
        "name": "Raw Read Error Rate",
        "desc_id": "Tingkat error saat membaca data langsung dari permukaan piringan/NAND.",
        "desc_en": "Rate of hardware read errors occurred when reading data from disk surface."
    },
    0x02: {
        "name": "Throughput Performance",
        "desc_id": "Efisiensi performa transfer data disk secara umum.",
        "desc_en": "Overall throughput performance of a hard disk drive."
    },
    0x03: {
        "name": "Spin Up Time",
        "desc_id": "Waktu yang dibutuhkan motor piringan HDD untuk mencapai kecepatan penuh.",
        "desc_en": "Average time of spindle spin up from zero to full operational speed."
    },
    0x04: {
        "name": "Start/Stop Count",
        "desc_id": "Berapa kali motor HDD mulai berputar dan berhenti.",
        "desc_en": "Total count of spindle start/stop cycles."
    },
    0x05: {
        "name": "Reallocated Sectors Count",
        "desc_id": "Sektor rusak yang berhasil dipindahkan ke blok cadangan (Spare Pool).",
        "desc_en": "Count of reallocated sectors transferred to the reserve spare area."
    },
    0x07: {
        "name": "Seek Error Rate",
        "desc_id": "Tingkat kegagalan head HDD dalam mencari lintasan silinder.",
        "desc_en": "Rate of seek errors of the magnetic heads."
    },
    0x08: {
        "name": "Seek Time Performance",
        "desc_id": "Kecepatan rata-rata head HDD saat mencari track data.",
        "desc_en": "Average performance of seek operations of the magnetic heads."
    },
    0x09: {
        "name": "Power-On Hours",
        "desc_id": "Total jam disk menyala sejak pertama kali diproduksi.",
        "desc_en": "Total count of hours in power-on state."
    },
    0x0A: {
        "name": "Spin Retry Count",
        "desc_id": "Jumlah percobaan ulang pemutaran motor HDD jika gagal di awal.",
        "desc_en": "Count of physical spin start attempts if the first attempt failed."
    },
    0x0B: {
        "name": "Calibration Retry Count",
        "desc_id": "Jumlah kalibrasi ulang head disk.",
        "desc_en": "Count of recalibrations requested by the drive."
    },
    0x0C: {
        "name": "Power Cycle Count",
        "desc_id": "Jumlah total PC dinyalakan atau disk dinyalakan ulang.",
        "desc_en": "Count of full power on/off cycles."
    },
    0xA1: {
        "name": "Available Reserved Blocks",
        "desc_id": "Jumlah blok cadangan yang masih tersedia di chip NAND.",
        "desc_en": "Number of remaining reserved flash memory blocks."
    },
    0xA2: {
        "name": "Cache Erase Count",
        "desc_id": "Siklus hapus pada SLC cache internal SSD.",
        "desc_en": "Total erase cycles on internal SLC cache blocks."
    },
    0xA3: {
        "name": "Max P/E Cycle",
        "desc_id": "Batas teoritis siklus program/erase sel NAND flash dari pabrik.",
        "desc_en": "Maximum rated Program/Erase cycles of the NAND flash."
    },
    0xA4: {
        "name": "Average Erase Count",
        "desc_id": "Rata-rata siklus erase yang telah dijalani seluruh blok memori.",
        "desc_en": "Average erase count across all flash blocks."
    },
    0xA5: {
        "name": "Max Erase Count",
        "desc_id": "Siklus erase tertinggi pada blok NAND tertentu.",
        "desc_en": "Maximum erase count on any individual flash block."
    },
    0xA6: {
        "name": "Total Bad Block Count",
        "desc_id": "Jumlah total blok memori NAND yang cacat atau rusak permanen.",
        "desc_en": "Total count of factory and runtime bad flash blocks."
    },
    0xA7: {
        "name": "SSD Protect Mode",
        "desc_id": "Status proteksi SSD (read-only mode jika degradasi parah).",
        "desc_en": "Protection mode state (e.g. read-only fallback on severe wear)."
    },
    0xA8: {
        "name": "SATA PHY Error Count",
        "desc_id": "Error komunikasi lapisan fisik antarmuka SATA.",
        "desc_en": "Physical layer error count over SATA interface."
    },
    0xA9: {
        "name": "Health / Remaining Life",
        "desc_id": "Nilai asli sisa umur sel memori SSD berdasarkan wear leveling.",
        "desc_en": "Actual remaining lifetime percentage based on flash wear leveling."
    },
    0xAB: {
        "name": "Program Fail Count",
        "desc_id": "Kegagalan controller saat menuliskan data ke sel memori.",
        "desc_en": "Number of flash program failures during write operations."
    },
    0xAC: {
        "name": "Erase Fail Count",
        "desc_id": "Kegagalan controller saat menghapus data di sel memori.",
        "desc_en": "Number of flash block erase failures."
    },
    0xAE: {
        "name": "Unexpected Power Loss",
        "desc_id": "Mati mendadak / mati listrik tanpa proses safe shutdown Windows.",
        "desc_en": "Number of power disruptions without graceful host shutdown."
    },
    0xAF: {
        "name": "ECC Fail Count",
        "desc_id": "Jumlah kegagalan koreksi error bit data.",
        "desc_en": "Count of uncorrectable ECC bit errors."
    },
    0xB5: {
        "name": "Unaligned Access Count",
        "desc_id": "Akses baca/tulis yang tidak selaras dengan batasan page NAND.",
        "desc_en": "Count of unaligned host read/write operations."
    },
    0xBB: {
        "name": "Reported Uncorrectable Errors",
        "desc_id": "Error data yang tidak dapat diperbaiki oleh kode koreksi internal.",
        "desc_en": "Count of errors that could not be recovered using hardware ECC."
    },
    0xBC: {
        "name": "Command Timeout",
        "desc_id": "Operasi baca/tulis yang terhenti karena disk tidak merespons.",
        "desc_en": "Count of aborted operations due to drive communication timeout."
    },
    0xC0: {
        "name": "Power-Off Retract Count",
        "desc_id": "Jumlah head HDD ditarik darurat akibat listrik mati mendadak.",
        "desc_en": "Count of emergency head retracts due to abrupt power loss."
    },
    0xC1: {
        "name": "Load/Unload Cycle Count",
        "desc_id": "Berapa kali head piringan HDD masuk dan keluar dari landing zone.",
        "desc_en": "Count of read/write head load and unload cycles."
    },
    0xC2: {
        "name": "Temperature",
        "desc_id": "Suhu sensor disk saat ini (°C).",
        "desc_en": "Current internal sensor temperature of the drive (°C)."
    },
    0xC3: {
        "name": "Hardware ECC Recovered",
        "desc_id": "Jumlah error bit yang berhasil diperbaiki oleh chip controller.",
        "desc_en": "Count of bit errors successfully recovered by hardware ECC engine."
    },
    0xC4: {
        "name": "Reallocation Event Count",
        "desc_id": "Berapa kali proses pemindahan sektor rusak dilakukan.",
        "desc_en": "Number of attempts to transfer data from reallocated sectors."
    },
    0xC5: {
        "name": "Current Pending Sector Count",
        "desc_id": "Sektor yang tidak stabil dan menunggu proses relokasi.",
        "desc_en": "Count of unstable sectors waiting to be remapped."
    },
    0xC6: {
        "name": "Offline Uncorrectable Sector Count",
        "desc_id": "Sektor rusak yang tidak bisa dibaca sama sekali saat self-test.",
        "desc_en": "Count of uncorrectable sectors found during background scanning."
    },
    0xC7: {
        "name": "UltraDMA CRC Error Count",
        "desc_id": "Error checksum transfer data kabel SATA.",
        "desc_en": "Count of transmission checksum errors over the SATA data cable."
    },
    0xCE: {
        "name": "Minimum Erase Count",
        "desc_id": "Siklus erase terendah pada sel memori SSD.",
        "desc_en": "Minimum block erase count recorded across all blocks."
    },
    0xCF: {
        "name": "Maximum Erase Count",
        "desc_id": "Siklus erase tertinggi pada sel memori SSD.",
        "desc_en": "Maximum block erase count recorded on the most cycled block."
    },
    0xE6: {
        "name": "Drive Life Protection Status",
        "desc_id": "Status ketahanan SSD terhadap keausan data.",
        "desc_en": "Overall drive endurance and wear status protection level."
    },
    0xE8: {
        "name": "Available Reserved Space",
        "desc_id": "Persentase ruang blok memori cadangan yang masih tersisa.",
        "desc_en": "Percentage of remaining reserve flash spare space."
    },
    0xE9: {
        "name": "Media Wearout Indicator",
        "desc_id": "Indikator keausan media penyimpanan.",
        "desc_en": "Wearout indicator tracking raw flash cell degradation."
    },
    0xEA: {
        "name": "Total Erase Count",
        "desc_id": "Total akumulasi siklus erase seluruh blok memori.",
        "desc_en": "Total cumulative erase cycles executed across all blocks."
    },
    0xF1: {
        "name": "Total Host Writes (GB)",
        "desc_id": "Total volume data yang ditulis oleh sistem operasi ke drive.",
        "desc_en": "Total gigabytes of data written by the operating system."
    },
    0xF2: {
        "name": "Total Host Reads (GB)",
        "desc_id": "Total volume data yang dibaca oleh sistem operasi dari drive.",
        "desc_en": "Total gigabytes of data read by the operating system."
    },
    0xF9: {
        "name": "Total NAND Writes (GB)",
        "desc_id": "Total penulisan aktual controller ke sel NAND flash fisik.",
        "desc_en": "Actual data volume committed by controller to physical NAND cells."
    },
    0xFA: {
        "name": "NAND Writes / Erases Extended",
        "desc_id": "Data penulisan fisik tingkat lanjut pada sel NAND.",
        "desc_en": "Extended raw flash telemetry of physical write/erase cycles."
    },
}

NVME_SMART_NAMES = {
    0x01: {
        "name": "Critical Warning",
        "desc_id": "Peringatan status kritis controller (suhu ekstrem, spare habis, read-only).",
        "desc_en": "Controller critical alerts (high temperature, spare depleted, read-only)."
    },
    0x02: {
        "name": "Composite Temperature",
        "desc_id": "Suhu gabungan controller dan memori NAND (°C).",
        "desc_en": "Current composite temperature of controller and flash memory (°C)."
    },
    0x03: {
        "name": "Available Spare",
        "desc_id": "Persentase memori cadangan yang masih utuh (Normal: 100%).",
        "desc_en": "Normalized percentage of remaining spare capacity (Normal: 100%)."
    },
    0x04: {
        "name": "Available Spare Threshold",
        "desc_id": "Batas minimal spare sebelum sistem membunyikan alarm peringatan.",
        "desc_en": "Pre-defined threshold percentage triggering low-spare alarms."
    },
    0x05: {
        "name": "Percentage Used",
        "desc_id": "Persentase estimasi masa pakai SSD yang telah dikonsumsi.",
        "desc_en": "Estimated percentage of device life consumed based on vendor spec."
    },
    0x06: {
        "name": "Data Units Read",
        "desc_id": "Total unit data terbaca (1 unit = 512.000 byte / 1000 sektor).",
        "desc_en": "Number of 512,000-byte data units read by host."
    },
    0x07: {
        "name": "Data Units Written",
        "desc_id": "Total unit data tertulis ke SSD.",
        "desc_en": "Number of 512,000-byte data units written by host."
    },
    0x08: {
        "name": "Host Read Commands",
        "desc_id": "Jumlah instruksi baca yang dikirim oleh prosesor/OS.",
        "desc_en": "Total number of read commands completed by controller."
    },
    0x09: {
        "name": "Host Write Commands",
        "desc_id": "Jumlah instruksi tulis yang dikirim oleh prosesor/OS.",
        "desc_en": "Total number of write commands completed by controller."
    },
    0x0A: {
        "name": "Controller Busy Time",
        "desc_id": "Total menit controller bekerja memproses antrean I/O.",
        "desc_en": "Amount of time controller is busy processing I/O commands (minutes)."
    },
    0x0B: {
        "name": "Power Cycles",
        "desc_id": "Jumlah berapa kali NVMe dimatikan dan dihidupkan.",
        "desc_en": "Total number of power-on cycles."
    },
    0x0C: {
        "name": "Power On Hours",
        "desc_id": "Total jam operasional SSD menyala.",
        "desc_en": "Number of power-on hours recorded."
    },
    0x0D: {
        "name": "Unsafe Shutdowns",
        "desc_id": "Jumlah mati mendadak tanpa perintah shutdown resmi dari OS.",
        "desc_en": "Number of power loss events without preceding shutdown notification."
    },
    0x0E: {
        "name": "Media and Data Integrity Errors",
        "desc_id": "Error integritas data yang terdeteksi controller (misal ECC gagal).",
        "desc_en": "Occurrences where data integrity was compromised (uncorrectable ECC)."
    },
    0x0F: {
        "name": "Number of Error Information Log Entries",
        "desc_id": "Jumlah catatan kegagalan/error yang terekam pada log NVMe.",
        "desc_en": "Number of error information log entries logged by drive."
    },
}


def decode_ata_smart_table(raw_bytes_list, thresh_bytes_or_dict=None):
    """
    Mendecode blok SMART ATA 512-byte (MSStorageDriver_ATAPISmartData.VendorSpecific)
    dan mengaitkan nilai ambang batas (Threshold) jika tersedia.
    Struktur tiap atribut: 12 byte (dimulai offset 2)
    Byte 0: ID
    Byte 1-2: Status Flags
    Byte 3: Current Value (Normalized 0-100/200)
    Byte 4: Worst Value
    Byte 5-10: Raw Value (6 byte little endian)
    """
    attributes = []
    if not raw_bytes_list or len(raw_bytes_list) < 362:
        return attributes

    thresholds = {}
    if isinstance(thresh_bytes_or_dict, (list, bytes, tuple)) and len(thresh_bytes_or_dict) >= 362:
        for ti in range(2, min(len(thresh_bytes_or_dict), 362), 12):
            taid = thresh_bytes_or_dict[ti]
            if taid > 0:
                thresholds[taid] = thresh_bytes_or_dict[ti + 1]
    elif isinstance(thresh_bytes_or_dict, dict):
        thresholds = thresh_bytes_or_dict

    for i in range(2, 362, 12):
        attr_id = raw_bytes_list[i]
        if attr_id == 0:
            continue
        current_val = raw_bytes_list[i + 3]
        worst_val = raw_bytes_list[i + 4]
        raw_slice = raw_bytes_list[i + 5 : i + 11]
        
        raw_val = 0
        for byte_idx, b in enumerate(raw_slice):
            raw_val |= (b << (8 * byte_idx))
            
        attr_meta = ATA_SMART_NAMES.get(attr_id, {
            "name": f"Vendor Specific (0x{attr_id:02X})",
            "desc_id": "Atribut internal pabrikan.",
            "desc_en": "Vendor specific hardware attribute."
        })
        
        attributes.append({
            "id": attr_id,
            "id_hex": f"0x{attr_id:02X}",
            "name": attr_meta["name"],
            "desc_id": attr_meta["desc_id"],
            "desc_en": attr_meta["desc_en"],
            "current": current_val,
            "worst": worst_val,
            "threshold": thresholds.get(attr_id, 0),
            "raw_int": raw_val,
            "raw_hex": f"0x{raw_val:012X}",
        })
    return attributes

# Health evaluation lives in health_engine.py. Re-exported here for a stable import surface.
try:
    from health_engine import (
        calculate_sata_true_health,
        calculate_nvme_true_health,
        calculate_hdd_health,
    )
except ImportError:
    from backend.health_engine import (
        calculate_sata_true_health,
        calculate_nvme_true_health,
        calculate_hdd_health,
    )

__all__ = [
    "ATA_SMART_NAMES",
    "NVME_SMART_NAMES",
    "decode_ata_smart_table",
    "calculate_sata_true_health",
    "calculate_nvme_true_health",
    "calculate_hdd_health",
]
