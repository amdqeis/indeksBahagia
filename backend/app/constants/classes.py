FIXED_CLASS_LIST = [
    "10-1",
    "10-2",
    "11-1",
    "11-2",
    "12-1",
    "12-2",
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

