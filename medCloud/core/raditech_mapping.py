"""
Mapping from MedCloud study types (REQUESTED_STUDY_CHOICES)
to Raditech modality and procedure IDs.

The modality station IDs are specific to the demo environment.
The first matching station for each modality type is used.

Modality Types available in the demo:
  - CT (ModalityID: 62aeeacdb63e2a35ed39406b)
    Stations: CT 201 (6496af9dda784a9490108dfd), CT 101 (64744eff744ed0227482e73b)
  - DX (ModalityID: 62aeeacdb63e2a35ed39406d)
    Stations: DXS1 (64d65ea2784ab8bfeda10963), Sala 3 RX (6834fdf9f91107e056bb0ae3)
"""

# Default modality station IDs (first station for each type)
CT_STATION_ID = "6496af9dda784a9490108dfd"
DX_STATION_ID = "64d65ea2784ab8bfeda10963"

# Modality IDs (used for procedure lookup)
CT_MODALITY_ID = "62aeeacdb63e2a35ed39406b"
DX_MODALITY_ID = "62aeeacdb63e2a35ed39406d"


STUDY_TYPE_MAPPING = {
    # ── Rayos X ────────────────────────────────────────────────
    "Torax PA": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4b8",  # TELE DE TORAX P.A.
    },
    "Torax PA y lat": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4b6",  # TORAX 3 POSICIONES
    },
    "Abdomen de cúbito": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4af",  # ABDOMEN 1 POSICION
    },
    "Abdomen de pie": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4b0",  # ABDOMEN 2 POSICIONES
    },
    "Cráneo Ap y lat": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf480",  # CRANEO 3 POSICIONES
    },
    "Senos Paranasales 3": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4a3",  # SENOS DE LA CARA 3 POSICIONES
    },
    "Columna Ap y lat": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf47a",  # COLUMNA LUMBAR 2 POSICIONES
    },
    "Huesos": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf483",  # RX SERIE OSEA METASTASICA
    },
    "Otros": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
    "Uretrografía Retrógrada": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4ba",  # UROGRAFIA EXCRETORA
    },
    "Fistulografía": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
    "Tránsito Intestinal": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
    "Urografía Excretora": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4ba",  # UROGRAFIA EXCRETORA
    },
    "Cistograma (Simple / Transmiccional)": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c6",  # CISTOGRAMA
    },
    "Cistouretrografía": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c6",  # CISTOGRAMA
    },
    "Colangiografía": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
    "Colangiografía en T": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
    "Histerosalpingografía": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf55e",  # HISTEROSALPINGOGRAFIA
    },

    # ── Mastografía ────────────────────────────────────────────
    "Mamografía": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c2",  # MAMOGRAFIA BILATERAL CON IMPLANTES
    },
    "Mamografía y US Mamas": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c2",  # MAMOGRAFIA BILATERAL CON IMPLANTES
    },

    # ── Procedimientos ─────────────────────────────────────────
    "Marcaje de Mama": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf55a",  # MARCAJE UNILATERAL DE MAMA
    },
    "Biopsia de Mama": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
    "Biopsia de Próstata": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
    "Baaf de tiroides": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },

    # ── Ultrasonido ────────────────────────────────────────────
    "Hígado y Vías Biliares (Boyden)": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO EXTREMIDADES Y LESIONES SUPERFICIALES
    },
    "Abdomen Superior": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO EXTREMIDADES Y LESIONES SUPERFICIALES
    },
    "Renal": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO EXTREMIDADES Y LESIONES SUPERFICIALES
    },
    "Pelvis": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf495",  # PELVIS 1 POSICION
    },
    "Vesical y próstata": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Abdomen Completo": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4b1",  # ABDOMEN 3 POSICIONES
    },
    "Mama Doppler": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c2",  # MAMOGRAFIA BILATERAL
    },
    "Obstétrico Doppler": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Obstétrico 4D": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Obstétrico Morfológico": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Endovaginal": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Transrectal de Próstata": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Doppler vascular Periférico": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },

    # ── Doppler ────────────────────────────────────────────────
    "Tiroides": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Cuello": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Carótidas": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Transfontanelar": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Mamas": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c2",  # MAMOGRAFIA
    },
    "Testicular": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },
    "Musculoesquelético": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c4",  # ECO
    },

    # ── Tomografía Computada ───────────────────────────────────
    "Cráneo (Simple / Contraste IV)": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4ed",  # TCH CRANEO SIMPLE Y CONTRASTADA
    },
    "Cuello (Simple / Contraste IV)": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4ef",  # TCH CUELLO SIMPLE Y CONTRASTADA
    },
    "Torax (Simple / Contraste IV)": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4df",  # TCH TORAX SIMPLE Y CONTRASTADA
    },
    "Abdomen y Pelvis (Simple / Contraste IV / Contraste Oral / Trifásica (hígado))": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4dc",  # TCH ABDOMEN Y PELVIS SIMPLE Y CONTRASTADA
    },
    "Urotomografía (fase eliminación)": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4fe",  # TCH UROTOMOGRAFIA SIMPLE Y CONTRASTADA
    },
    "Senos Paranasales": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf505",  # TCH SIMPLIFICADO DE SENOS PARANASALES
    },
    "Hueso Reconstrucción 3D": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4e8",  # TCH PELVIS OSEA (3+ DIMENSION)
    },
    "AngioTac": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4f3",  # TCH ANGIOTOMOGRAFIA PULMONAR
    },
    "Columna": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4ea",  # TCH COLUMNA CERVICAL SIMPLE
    },
    "Otro": {
        "modality_station_id": CT_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed394353",  # Unknown (generic CT)
    },

    # ── Densitometría Ósea ─────────────────────────────────────
    "Densitometría Ósea": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "6638e36d50781affa3aaf4c5",  # DENSITOMETRIA OSEA
    },

    # ── Estudios Especiales ────────────────────────────────────
    "Estudios Especiales": {
        "modality_station_id": DX_STATION_ID,
        "procedure_id": "62aeeaceb63e2a35ed3943f4",  # Unknown (generic)
    },
}


def get_raditech_mapping(study_type):
    """
    Look up the Raditech modality station ID and procedure ID
    for a given MedCloud study type.

    Returns:
        dict with 'modality_station_id' and 'procedure_id', or None if not found.
    """
    return STUDY_TYPE_MAPPING.get(study_type)
