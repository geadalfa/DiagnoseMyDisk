"""
hardware_profile.py
Mesin Deteksi Fitur Hardware, Tipe NAND Flash (SLC/MLC/TLC/QLC),
Arsitektur Cache (DRAM / HMB / SLC Cache), dan Glosarium Edukatif DiagnoseMyDisk.
"""

import re


def detect_hardware_profile(name, media_type="SSD", bus_type="SATA", size_gb=0, smart_attributes=None):
    """
    Menganalisis identitas disk untuk mengidentifikasi tipe NAND Flash,
    teknologi sel, arsitektur DRAM/HMB cache, dan kumpulan fitur hardware aktif.
    """
    clean_name = (name or "").upper()
    media_upper = (media_type or "").upper()
    bus_upper = (bus_type or "").upper()
    is_ssd = "SSD" in media_upper or "NVME" in bus_upper or "NVME" in clean_name or "FLASH" in clean_name
    is_nvme = "NVME" in bus_upper or "PCIE" in bus_upper or "LEGEND" in clean_name or "980" in clean_name or "990" in clean_name

    # Default baseline
    nand_type = "3D TLC NAND Flash" if is_ssd else "CMR Magnetic Platter"
    cell_tech_name = "TLC (Triple-Level Cell)" if is_ssd else "Piringan Magnetik"
    cell_bits = 3 if is_ssd else 0
    dram_cache = "DRAM-less (Host Memory Buffer / HMB)" if (is_ssd and is_nvme) else ("DRAM-less (SLC Caching)" if is_ssd else "64 MB DRAM Buffer")
    controller_family = "Multi-Core Flash Controller" if is_ssd else "SATA HDD Controller"
    interface_standard = "PCIe 4.0 x4 (NVMe 1.4)" if is_nvme else ("SATA III 6.0 Gb/s" if is_ssd else "SATA III 6.0 Gb/s")
    durability_pe_cycles = "1,500 - 3,000 P/E Cycles" if is_ssd else "Unlimited Magnetic Rewrites (MTBF ~1M Hours)"
    slc_cache_type = "Dynamic Pseudo-SLC Cache" if is_ssd else "N/A (Rotational Media)"

    # Cek database model spesifik
    # 1. ADATA LEGEND Series
    if "LEGEND 900" in clean_name:
        nand_type = "3D TLC NAND Flash (176/232-Layer)"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "DRAM-less dengan HMB (Host Memory Buffer) & SLC Cache Dinamis"
        controller_family = "Maxio MAP1602A / Realtek RTS5762 (PCIe Gen4)"
        interface_standard = "PCIe Gen4 x4 (NVMe 1.4, hingga 7,400 MB/s)"
        durability_pe_cycles = "~1,500 - 3,000 P/E Cycles (Rating 2000 TBW pada 2TB)"
        slc_cache_type = "SLC Caching Dinamis + LDPC ECC Tingkat Lanjut"

    elif "LEGEND 800" in clean_name or "LEGEND 850" in clean_name or "LEGEND 700" in clean_name:
        nand_type = "3D TLC NAND Flash"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "DRAM-less (HMB Supported)"
        controller_family = "Silicon Motion SM2267XT / Phison PS5015"
        interface_standard = "PCIe Gen4 x4 (NVMe 1.4)"
        durability_pe_cycles = "1,500 - 3,000 P/E Cycles"
        slc_cache_type = "Dynamic SLC Caching"

    # 2. ADATA SU650 / SU630 / SU800
    elif "SU650" in clean_name:
        # SU650 sebagian besar 3D TLC NAND, sebagian batch 3D QLC
        nand_type = "3D NAND Flash (TLC / BiCS 3D)"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "DRAM-less (SLC Caching Cerdas Terpadu)"
        controller_family = "Silicon Motion SM2258XT / Realtek RTS5732DL"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "~1,000 - 2,000 P/E Cycles"
        slc_cache_type = "Intelligent SLC Caching Algorithm"

    elif "SU630" in clean_name:
        nand_type = "3D QLC NAND Flash"
        cell_tech_name = "QLC (Quad-Level Cell)"
        cell_bits = 4
        dram_cache = "DRAM-less (SLC Caching Ekstra Besar)"
        controller_family = "Maxio MAS0902 / Realtek"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "~300 - 800 P/E Cycles"
        slc_cache_type = "Large Dynamic SLC Cache"

    elif "SU800" in clean_name or "SX8200" in clean_name:
        nand_type = "3D TLC NAND Flash"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "Dedicated DDR3/DDR4 DRAM Cache Onboard"
        controller_family = "Silicon Motion SM2258 / SM2262EN"
        interface_standard = "PCIe Gen3 x4 / SATA III"
        durability_pe_cycles = "1,500 - 3,000 P/E Cycles"
        slc_cache_type = "Dual SLC Caching Buffer"

    # 3. SanDisk SSD Plus / Ultra / Extreme
    elif "SDSSDA" in clean_name or "SANDISK SSD PLUS" in clean_name or ("SANDISK" in clean_name and "120G" in clean_name):
        nand_type = "SanDisk / Kioxia BiCS 3D TLC NAND"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "DRAM-less (SLC Cache Terintegrasi)"
        controller_family = "Silicon Motion SM2246XT / SM2256S / SanDisk Custom"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "~1,000 - 2,000 P/E Cycles"
        slc_cache_type = "SLC Caching Terbuka"

    # 4. Western Digital HDDs (WD Blue, Black, Red)
    elif "WD20EZAZ" in clean_name or ("WD20" in clean_name and "EZAZ" in clean_name):
        nand_type = "Piringan Magnetik SMR (Shingled Magnetic Recording)"
        cell_tech_name = "SMR (Trek Magnetik Bertumpuk / Shingled)"
        cell_bits = 0
        dram_cache = "256 MB Dedicated DRAM Cache Buffer"
        controller_family = "Marvell / WD In-House Microcontroller (5400 RPM)"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "MTBF 1,000,000 Jam (Bebas Batasan P/E Flash)"
        slc_cache_type = "N/A (256MB Media Cache Buffer)"

    elif "WD20EZEX" in clean_name or "EZEX" in clean_name:
        nand_type = "Piringan Magnetik CMR (Conventional Magnetic Recording)"
        cell_tech_name = "CMR (Trek Paralel Konvensional)"
        cell_bits = 0
        dram_cache = "64 MB Dedicated DRAM Cache Buffer"
        controller_family = "Marvell / WD In-House Microcontroller (7200 RPM)"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "MTBF 1,000,000 Jam"
        slc_cache_type = "N/A"

    elif "WDC" in clean_name or "WESTERN DIGITAL" in clean_name:
        if is_ssd:
            if "SN850" in clean_name:
                nand_type = "Kioxia/SanDisk BiCS 3D TLC NAND"
                cell_tech_name = "TLC (Triple-Level Cell)"
                cell_bits = 3
                dram_cache = "DDR4 DRAM Cache Onboard"
                controller_family = "WD Black G2 Proprietary Controller"
                interface_standard = "PCIe Gen4 x4 (NVMe 1.4)"
                durability_pe_cycles = "1,500 - 3,000 P/E Cycles"
            elif "SN770" in clean_name or "SN580" in clean_name or "SN570" in clean_name:
                nand_type = "Kioxia/SanDisk BiCS 3D TLC NAND"
                cell_tech_name = "TLC (Triple-Level Cell)"
                cell_bits = 3
                dram_cache = "DRAM-less (Host Memory Buffer / HMB)"
                controller_family = "WD In-House 4-Channel DRAM-less Controller"
                interface_standard = "PCIe Gen4 x4 (NVMe 1.4)" if "SN770" in clean_name or "SN580" in clean_name else "PCIe Gen3 x4"
                durability_pe_cycles = "1,500 - 3,000 P/E Cycles"
            else:
                nand_type = "3D TLC NAND Flash"
                cell_tech_name = "TLC (Triple-Level Cell)"
                cell_bits = 3
                dram_cache = "DRAM-less (SLC Caching)"
                controller_family = "WD / SanDisk Controller"
                interface_standard = "SATA III / NVMe"
        else:
            nand_type = "Piringan Magnetik (HDD Rotasional)"
            cell_tech_name = "HDD Mekanikal"
            cell_bits = 0
            dram_cache = "64 MB - 256 MB DRAM Buffer"
            controller_family = "Western Digital Drive Controller"
            interface_standard = "SATA III 6.0 Gb/s"

    # 5. Samsung Series
    elif "990 PRO" in clean_name or "980 PRO" in clean_name:
        nand_type = "Samsung V-NAND 3D TLC (176-Layer)"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "Samsung Low Power DDR4 (LPDDR4) Dedicated DRAM"
        controller_family = "Samsung Pascal / Elpis Controller"
        interface_standard = "PCIe Gen4 x4 (NVMe 2.0)"
        durability_pe_cycles = "1,500 - 3,000 P/E Cycles"
    elif "970 PRO" in clean_name:
        nand_type = "Samsung V-NAND 2-bit MLC"
        cell_tech_name = "MLC (Multi-Level Cell - 2 Bit)"
        cell_bits = 2
        dram_cache = "Samsung LPDDR4 Dedicated DRAM"
        controller_family = "Samsung Phoenix Controller"
        interface_standard = "PCIe Gen3 x4"
        durability_pe_cycles = "~6,000 - 10,000 P/E Cycles"
    elif "QVO" in clean_name: # e.g. 870 QVO
        nand_type = "Samsung V-NAND 3D QLC"
        cell_tech_name = "QLC (Quad-Level Cell)"
        cell_bits = 4
        dram_cache = "Dedicated LPDDR4 DRAM Cache"
        controller_family = "Samsung MKX Controller"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "~300 - 1,000 P/E Cycles"
        slc_cache_type = "Intelligent TurboWrite (SLC Cache)"

    # 6. Crucial / Micron Series
    elif "P3" in clean_name or "P3 PLUS" in clean_name:
        nand_type = "Micron 176-Layer 3D QLC NAND"
        cell_tech_name = "QLC (Quad-Level Cell)"
        cell_bits = 4
        dram_cache = "DRAM-less (Host Memory Buffer / HMB)"
        controller_family = "Phison PS5021-E21T"
        interface_standard = "PCIe Gen4 x4" if "PLUS" in clean_name else "PCIe Gen3 x4"
        durability_pe_cycles = "~300 - 800 P/E Cycles"
        slc_cache_type = "Dynamic SLC Caching Buffer"
    elif "MX500" in clean_name:
        nand_type = "Micron 3D TLC NAND"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "Dedicated DDR3/DDR4 DRAM Cache"
        controller_family = "Silicon Motion SM2258"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "1,500 - 3,000 P/E Cycles"
    elif "BX500" in clean_name:
        nand_type = "Micron 3D TLC / QLC NAND"
        cell_tech_name = "TLC / QLC"
        cell_bits = 3
        dram_cache = "DRAM-less (SLC Caching)"
        controller_family = "Silicon Motion SM2258XT / SM2259XT"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "500 - 1,500 P/E Cycles"

    # 7. Kingston Series
    elif "NV2" in clean_name:
        nand_type = "3D QLC / TLC NAND (Varian Batch)"
        cell_tech_name = "QLC / TLC"
        cell_bits = 4
        dram_cache = "DRAM-less (Host Memory Buffer / HMB)"
        controller_family = "Silicon Motion SM2267XT / Phison E21T"
        interface_standard = "PCIe Gen4 x4"
        durability_pe_cycles = "~300 - 1,000 P/E Cycles"
    elif "KC3000" in clean_name or "FURY RENEGADE" in clean_name:
        nand_type = "Micron 176-Layer 3D TLC NAND"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "DDR4 DRAM Cache Onboard"
        controller_family = "Phison PS5018-E18"
        interface_standard = "PCIe Gen4 x4 (NVMe 1.4)"
        durability_pe_cycles = "1,500 - 3,000 P/E Cycles"
    elif "A400" in clean_name:
        nand_type = "2D / 3D TLC NAND"
        cell_tech_name = "TLC (Triple-Level Cell)"
        cell_bits = 3
        dram_cache = "DRAM-less (SLC Caching)"
        controller_family = "Phison S11 / Silicon Motion SM2258XT"
        interface_standard = "SATA III 6.0 Gb/s"
        durability_pe_cycles = "1,000 - 2,000 P/E Cycles"

    # Bangun daftar fitur aktif
    features_list = []
    
    # S.M.A.R.T selalu aktif di semua drive modern
    features_list.append({
        "tag": "S.M.A.R.T",
        "name_id": "Pemantauan S.M.A.R.T",
        "name_en": "S.M.A.R.T Telemetry",
        "supported": True,
        "badge_color": "blue",
        "desc_id": "Self-Monitoring, Analysis and Reporting Technology aktif memantau degradasi perangkat.",
        "desc_en": "Self-Monitoring, Analysis and Reporting Technology actively tracking hardware health."
    })

    if is_ssd:
        # TRIM
        features_list.append({
            "tag": "TRIM",
            "name_id": "Instruksi Pembersihan TRIM",
            "name_en": "TRIM Deallocate Command",
            "supported": True,
            "badge_color": "emerald",
            "desc_id": "Memberitahu controller SSD untuk menghapus data usang di blok NAND secara pasif agar performa tulis tetap kencang.",
            "desc_en": "Informs the SSD controller which blocks are no longer in use so they can be reclaimed in the background."
        })

        # SLC Caching
        features_list.append({
            "tag": "SLC Cache",
            "name_id": "Akselerasi SLC Caching",
            "name_en": "SLC Caching Buffer",
            "supported": True,
            "badge_color": "amber",
            "desc_id": "Menulis sementara pada mode 1-bit ultra cepat sebelum memindahkan data ke sel multi-level di latar belakang.",
            "desc_en": "Temporarily writes in ultra-fast 1-bit mode before folding data into high-density cells."
        })

        # DRAM atau HMB
        if "HMB" in dram_cache:
            features_list.append({
                "tag": "HMB",
                "name_id": "Host Memory Buffer (HMB)",
                "name_en": "Host Memory Buffer (HMB)",
                "supported": True,
                "badge_color": "purple",
                "desc_id": "Menggunakan sebagian kecil RAM utama PC (~64MB) via PCIe DMA untuk caching tabel FTL tanpa butuh chip DRAM mahal di SSD.",
                "desc_en": "Allocates ~64MB host PC RAM via PCIe DMA for FTL mapping cache without requiring onboard DRAM chips."
            })
        elif "DEDICATED" in dram_cache.upper() or "DDR" in dram_cache.upper():
            features_list.append({
                "tag": "DRAM Buffer",
                "name_id": "Dedicated Onboard DRAM",
                "name_en": "Dedicated Onboard DRAM",
                "supported": True,
                "badge_color": "purple",
                "desc_id": "Dilengkapi chip memori RAM fisik independen di PCB untuk respon akses tabel pemetaan alamat file tercepat.",
                "desc_en": "Equipped with dedicated physical DRAM on the PCB for lightning-fast mapping table lookups."
            })

        # LDPC ECC
        features_list.append({
            "tag": "LDPC ECC",
            "name_id": "Koreksi Error LDPC",
            "name_en": "LDPC ECC Engine",
            "supported": True,
            "badge_color": "zinc",
            "desc_id": "Algoritma Low-Density Parity-Check canggih mendeteksi dan mengoreksi bit data yang tergeser oleh voltase flash.",
            "desc_en": "Advanced Low-Density Parity-Check algorithm correcting bit-flip errors caused by flash voltage drift."
        })

        # Wear Leveling
        features_list.append({
            "tag": "Wear Leveling",
            "name_id": "Perataan Keausan (Wear Leveling)",
            "name_en": "Global Wear Leveling",
            "supported": True,
            "badge_color": "zinc",
            "desc_id": "Menyebarkan siklus penulisan data secara merata ke seluruh blok silikon agar tidak ada chip yang aus lebih cepat.",
            "desc_en": "Evenly distributes write cycles across all silicon blocks to prevent premature individual cell failure."
        })

        if is_nvme:
            # NVMe APST & Thermal Throttling
            features_list.append({
                "tag": "Thermal Throttling",
                "name_id": "Proteksi Suhu Otomatis",
                "name_en": "Dynamic Thermal Throttling",
                "supported": True,
                "badge_color": "rose",
                "desc_id": "Sensor termal presisi menurunkan clockspeed saat beban ekstrem untuk mencegah kerusakan sel silikon akibat panas.",
                "desc_en": "Precision thermal sensor automatically steps down clocks during extreme loads to prevent heat damage."
            })
    else:
        # HDD Features
        features_list.append({
            "tag": "NCQ",
            "name_id": "Native Command Queuing (NCQ)",
            "name_en": "Native Command Queuing (NCQ)",
            "supported": True,
            "badge_color": "blue",
            "desc_id": "Mengatur antrean hingga 32 perintah baca/tulis agar rotasi head mekanik bergerak di jalur terpendek.",
            "desc_en": "Reorders up to 32 I/O requests so the mechanical read head takes the most efficient physical path."
        })

        features_list.append({
            "tag": "DRAM Buffer",
            "name_id": "Cache Buffer Piringan",
            "name_en": "Drive Buffer Cache",
            "supported": True,
            "badge_color": "purple",
            "desc_id": f"Buffer memori cepat ({dram_cache}) mempercepat operasi transfer data sekuensial.",
            "desc_en": f"High-speed onboard buffer ({dram_cache}) accelerating sequential data transfers."
        })

        if "SMR" in clean_name or "SMR" in cell_tech_name:
            features_list.append({
                "tag": "SMR",
                "name_id": "Shingled Magnetic Recording",
                "name_en": "Shingled Magnetic Recording",
                "supported": True,
                "badge_color": "amber",
                "desc_id": "Trek data disusun bertumpuk seperti genteng untuk melipatgandakan kapasitas penyimpanan piringan fisik.",
                "desc_en": "Data tracks overlap like roof shingles to maximize areal storage capacity on magnetic platters."
            })

    # Edukasi Khusus NAND & QLC (Sesuai Permintaan Alfa)
    explanation = {
        "nand_type": nand_type,
        "cell_tech_name": cell_tech_name,
        "cell_bits": cell_bits,
        "dram_cache": dram_cache,
        "controller_family": controller_family,
        "interface_standard": interface_standard,
        "durability_pe_cycles": durability_pe_cycles,
        "slc_cache_type": slc_cache_type,
        "summary_id": generate_summary_id(clean_name, is_ssd, is_nvme, nand_type, cell_bits, dram_cache),
        "summary_en": generate_summary_en(clean_name, is_ssd, is_nvme, nand_type, cell_bits, dram_cache),
    }

    return {
        "nand_type": nand_type,
        "cell_tech_name": cell_tech_name,
        "cell_bits": cell_bits,
        "dram_cache": dram_cache,
        "controller_family": controller_family,
        "interface_standard": interface_standard,
        "durability_pe_cycles": durability_pe_cycles,
        "slc_cache_type": slc_cache_type,
        "features": features_list,
        "explanation": explanation
    }


def generate_summary_id(clean_name, is_ssd, is_nvme, nand_type, cell_bits, dram_cache):
    """Menghasilkan rangkuman teknis dalam Bahasa Indonesia yang natural dan jelas."""
    if not is_ssd:
        if "SMR" in nand_type or "EZAZ" in clean_name:
            return (
                "Drive ini adalah Hard Disk mekanikal berbasis teknologi **SMR (Shingled Magnetic Recording)** dengan buffer DRAM 256MB. "
                "Trek data ditulis saling bertumpuk seperti genteng untuk memaksimalkan kapasitas, sangat andal untuk penyimpanan arsip & media besar. "
                "Kecepatan tulis acak dapat melambat saat modifikasi data berulang, namun bebas dari degradasi sel silikon flash."
            )
        return (
            "Hard disk mekanikal piringan magnetik konvensional dengan motor spindle. "
            "Bebas batasan siklus P/E sel flash NAND dan ideal untuk penyimpanan data jangka panjang."
        )

    if cell_bits == 4 or "QLC" in nand_type:
        return (
            "Drive ini menggunakan teknologi **QLC (Quad-Level Cell)** yang menyimpan 4 bit data per sel fisik (16 status voltase). "
            "Kelebihan QLC adalah densitas penyimpanan sangat tinggi dengan harga per-GB lebih ekonomis. "
            "Untuk menjaga performa, SSD memanfaatkan **SLC Caching** cepat; kecepatan tulis akan menurun ke kecepatan murni QLC (~80-150 MB/s) "
            "jika menulis file berukuran sangat masif sekaligus setelah buffer SLC penuh."
        )
    elif cell_bits == 3 or "TLC" in nand_type:
        nvme_note = "dengan dukungan **HMB (Host Memory Buffer)** memanfaatkan memori sistem untuk menjaga latensi tetap minim." if "HMB" in dram_cache else "dengan algoritma caching optimal."
        return (
            f"Drive ini menggunakan teknologi **3D TLC (Triple-Level Cell)** yang menyimpan 3 bit data per sel (8 level voltase). "
            f"TLC adalah standar emas industri modern yang memberikan keseimbangan sempurna antara kecepatan transfer, daya tahan siklus hapus-tulis (~1.500-3.000 P/E Cycles), "
            f"dan stabilitas jangka panjang, {nvme_note}"
        )
    elif cell_bits == 2 or "MLC" in nand_type:
        return (
            "Drive ini menggunakan sel memori **MLC (Multi-Level Cell)** 2 bit per sel. "
            "Memiliki ketahanan fisik sangat tinggi (~3.000-10.000 P/E Cycles) dengan kestabilan tulis langsung tanpa fluktuasi drop cache."
        )
    return "Media penyimpanan berbasis flash NAND non-volatile dengan kontroler terpadu."


def generate_summary_en(clean_name, is_ssd, is_nvme, nand_type, cell_bits, dram_cache):
    """Menghasilkan rangkuman teknis dalam Bahasa Inggris yang natural dan jelas."""
    if not is_ssd:
        if "SMR" in nand_type or "EZAZ" in clean_name:
            return (
                "This drive is a mechanical Hard Disk Drive using **SMR (Shingled Magnetic Recording)** technology with a 256MB DRAM buffer. "
                "Data tracks overlap like roof shingles to maximize areal density, ideal for backup and mass media storage. "
                "Random rewrite speeds may throttle during sustained modifications, but it is free from flash silicon wearout."
            )
        return "Mechanical rotational hard disk drive. Operating without silicon P/E cycle wearout limits, ideal for long-term archiving."

    if cell_bits == 4 or "QLC" in nand_type:
        return (
            "This drive utilizes **QLC (Quad-Level Cell)** NAND flash, storing 4 bits per physical cell (16 distinct voltage states). "
            "QLC provides high storage density at an economical price per gigabyte. "
            "It relies on high-speed **SLC Caching** for everyday responsiveness; sustained writes exceeding the SLC cache buffer "
            "will drop to native QLC write speeds (~80-150 MB/s)."
        )
    elif cell_bits == 3 or "TLC" in nand_type:
        nvme_note = "paired with **HMB (Host Memory Buffer)** utilizing system RAM for ultra-low latency mapping." if "HMB" in dram_cache else "with intelligent dynamic caching."
        return (
            f"This drive utilizes **3D TLC (Triple-Level Cell)** NAND flash, storing 3 bits per cell (8 voltage states). "
            f"TLC represents the modern industry benchmark, offering an optimal balance of sustained throughput, P/E endurance (~1,500-3,000 cycles), "
            f"and long-term reliability, {nvme_note}"
        )
    elif cell_bits == 2 or "MLC" in nand_type:
        return (
            "This drive utilizes premium **MLC (Multi-Level Cell)** NAND with 2 bits per cell, "
            "delivering exceptional write endurance (~3,000-10,000 P/E cycles) and unthrottled direct-to-die write speeds."
        )
    return "Non-volatile NAND flash storage device with integrated controller."


def get_flash_technology_glossary():
    """
    Kamus edukasi komprehensif menjelaskan arti istilah hardware seperti QLC, TLC, SLC, DRAM, HMB, SMR dll.
    Disediakan bilingual untuk modal edukasi atau popover bantuan.
    """
    return {
        "slc": {
            "title": "SLC (Single-Level Cell)",
            "bits": 1,
            "pe_cycles": "50,000 - 100,000",
            "voltage_states": 2,
            "desc_id": (
                "Menyimpan 1 bit data (0 atau 1) per sel fisik. Karena hanya memerlukan 2 status voltase, "
                "SLC memiliki kecepatan akses paling kilat, latensi paling rendah, dan daya tahan paling perkasa. "
                "Kelemahan: Kapasitas per wafer silikon kecil dan biaya produksinya sangat mahal. "
                "Kini SLC umumnya digunakan sebagai blok **SLC Cache sementara** di dalam SSD TLC/QLC."
            ),
            "desc_en": (
                "Stores 1 bit of data per physical cell with only 2 voltage states. Offers maximum speed, lowest latency, "
                "and highest endurance (~100,000 P/E cycles). Primarily used today as pseudo-SLC dynamic write cache in TLC/QLC SSDs."
            )
        },
        "mlc": {
            "title": "MLC (Multi-Level Cell)",
            "bits": 2,
            "pe_cycles": "3,000 - 10,000",
            "voltage_states": 4,
            "desc_id": (
                "Menyimpan 2 bit data per sel (4 status voltase: 00, 01, 10, 11). "
                "Memberikan ketahanan fisik tinggi dan kecepatan tulis stabil tanpa drop tajam. "
                "Dahulu menjadi standar SSD enthusiast (seperti seri Samsung Pro lawas)."
            ),
            "desc_en": (
                "Stores 2 bits per physical cell across 4 voltage levels. Delivers high endurance and consistent native write speeds, "
                "formerly the hallmark of enthusiast-tier SSDs."
            )
        },
        "tlc": {
            "title": "TLC (Triple-Level Cell)",
            "bits": 3,
            "pe_cycles": "1,500 - 3,000",
            "voltage_states": 8,
            "desc_id": (
                "Menyimpan 3 bit data per sel (8 status voltase). **Standar emas industri SSD modern saat ini** "
                "(digunakan oleh ADATA Legend 900, Samsung 980/990 Pro, WD Black SN850X). "
                "Menawarkan perpaduan terbaik antara harga terjangkau, kapasitas lapang, performa tinggi, dan umur pakai panjang puluhan tahun."
            ),
            "desc_en": (
                "Stores 3 bits per cell across 8 voltage states. The modern industry standard (e.g., ADATA Legend 900, Samsung 980/990, WD Black), "
                "providing an optimal combination of speed, endurance, and cost efficiency."
            )
        },
        "qlc": {
            "title": "QLC (Quad-Level Cell)",
            "bits": 4,
            "pe_cycles": "300 - 1,000",
            "voltage_states": 16,
            "desc_id": (
                "Menyimpan 4 bit data dalam 1 sel tunggal (16 variasi voltase mikro). "
                "**Maksud & Tujuan Fitur QLC:** Meningkatkan kapasitas penyimpanan sebesar 33% dibandingkan TLC pada ukuran chip silikon yang sama, "
                "memungkinkan pembuatan SSD berkapasitas sangat besar (2TB, 4TB, 8TB) dengan harga jauh lebih murah.\n\n"
                "**Karakteristik & Trade-off QLC:**\n"
                "1. *Kecepatan Asli Lebih Rendah:* Karena mengukur 16 level voltase sangat rumit, kecepatan tulis asli chip QLC berkisar 80-150 MB/s.\n"
                "2. *Ketergantungan SLC Cache:* SSD QLC mengatasinya dengan 'SLC Cache' berukuran besar. Selama cache ini belum penuh, transfer terasa secepat 3.000-5.000 MB/s. "
                "Namun jika Anda menyalin file raksasa (misal 80GB sekaligus), kecepatan akan turun begitu cache habis.\n"
                "3. *Daya Tahan P/E Cycles:* Berkisar antara 300 - 1.000 siklus hapus. Sangat aman dan mencukupi untuk gaming, booting, dan komputasi harian."
            ),
            "desc_en": (
                "Stores 4 bits per cell across 16 micro-voltage levels. "
                "**Purpose of QLC:** Provides 33% higher storage density than TLC, making large capacity SSDs (2TB-8TB) much more affordable.\n\n"
                "**Characteristics & Trade-offs:**\n"
                "1. *Native Write Speeds:* Reading/writing 16 voltage levels is computationally demanding; raw write speeds hover around 80-150 MB/s.\n"
                "2. *SLC Cache Reliance:* Uses large dynamic pseudo-SLC buffers. Everyday transfers are blazingly fast (3,000-5,000 MB/s), but sustained massive transfers will throttle once cache is exhausted.\n"
                "3. *Endurance:* 300 - 1,000 P/E cycles, perfectly reliable for OS drives, gaming libraries, and daily workstation tasks."
            )
        },
        "dram_vs_hmb": {
            "title": "DRAM vs HMB (Host Memory Buffer)",
            "desc_id": (
                "**Apa itu DRAM pada SSD?** Chip memori RAM fisik pada PCB SSD yang bertugas menyimpan tabel pemetaan alamat file (Flash Translation Layer / FTL). "
                "Membuat pencarian data acak (Random 4K) berlangsung instan dalam hitungan nanodetik.\n\n"
                "**Apa itu DRAM-less & HMB?** SSD murah biasanya meniadakan chip DRAM untuk memangkas harga (DRAM-less). "
                "Pada interface NVMe modern (NVMe 1.2+), teknologi **HMB (Host Memory Buffer)** memungkinkan SSD 'meminjam' ~64MB dari RAM PC Anda melalui jalur PCIe DMA. "
                "Hasilnya: SSD DRAM-less dengan HMB memiliki performa latensi yang hampir setara dengan SSD ber-DRAM fisik!"
            ),
            "desc_en": (
                "**What is SSD DRAM?** Dedicated RAM on the SSD board holding the Flash Translation Layer (FTL) lookup table for nanosecond random access.\n\n"
                "**What is DRAM-less & HMB?** Budget drives omit onboard DRAM. With NVMe 1.2+, **HMB (Host Memory Buffer)** borrows ~64MB of host PC RAM via PCIe DMA, delivering near-DRAM performance at lower manufacturing cost."
            )
        },
        "trim": {
            "title": "TRIM (Perintah Pembersihan Blok)",
            "desc_id": (
                "Ketika Anda menghapus file di Windows, sistem operasi hanya menghapus catatan indeksnya, bukan data fisik di chip flash. "
                "Perintah **TRIM** memberi tahu controller SSD blok mana yang sudah tidak dipakai, sehingga controller dapat menghapusnya di latar belakang (Garbage Collection). "
                "Tanpa TRIM, SSD harus membaca, menghapus, dan menulis ulang blok setiap kali ada data baru, memicu penurunan kecepatan dan Write Amplification tinggi."
            ),
            "desc_en": (
                "When files are deleted, OS only clears index pointers. The **TRIM** command informs the SSD controller which blocks are stale, allowing background Garbage Collection. Without TRIM, future writes require slow read-erase-write cycles."
            )
        },
        "smr_vs_cmr": {
            "title": "SMR vs CMR (Teknologi Piringan HDD)",
            "desc_id": (
                "**CMR (Conventional Magnetic Recording):** Track data ditulis berdampingan secara paralel tanpa saling tumpang tindih. Kecepatan baca dan tulis selalu konsisten stabil.\n\n"
                "**SMR (Shingled Magnetic Recording):** Track data ditulis saling menumpuk seperti genteng atap rumah (shingles) untuk memadatkan kapasitas piringan. "
                "Sangat hemat untuk penyimpanan data masif/backup (seperti WD Blue WD20EZAZ), namun penulisan ulang file kecil secara acak dapat melambat karena harus merewrite trek di sekitarnya."
            ),
            "desc_en": (
                "**CMR:** Data tracks sit side-by-side without overlapping, providing consistent write speeds.\n\n"
                "**SMR:** Data tracks overlap like shingles on a roof to maximize capacity (e.g. WD Blue WD20EZAZ). Excellent for archival and media storage, but random rewrite cycles may experience latency as adjacent tracks must be rewritten."
            )
        }
    }
