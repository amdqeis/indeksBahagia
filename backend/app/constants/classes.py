FIXED_CLASS_LIST = [
    "7 Zubair",
    "7 Aisyah",
    "8 Abu Bakar",
    "8 Utsman",
    "8 Fatimah",
    "8 Hajar",
    "9 Umar",
    "9 Khadijah",
]

FIXED_CLASS_SET = set(FIXED_CLASS_LIST)


def normalize_class_name(value):
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def is_valid_class_name(value):
    normalized = normalize_class_name(value)
    if normalized is None:
        return False
    return normalized in FIXED_CLASS_SET
