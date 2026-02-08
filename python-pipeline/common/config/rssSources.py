from enums.signal_type import SignalType

RSS_SOURCES = [
    {
        "id": "nngroup",
        "name": "Nielsen Norman Group",
        "url": "https://www.nngroup.com/feed/rss/",
        "signal_type": SignalType.WHY,
        "category": "UX Research",
        "language": "en",
        "priority": 1
    },
    {
        "id": "smashing",
        "name": "Smashing Magazine",
        "url": "https://www.smashingmagazine.com/feed/",
        "signal_type": SignalType.WHY,
        "category": "Web Design + UX",
        "language": "en",
        "priority": 1
    },
    {
        "id": "dezeen",
        "name": "Dezeen",
        "url": "https://www.dezeen.com/feed/",
        "signal_type": SignalType.WHY,
        "category": "Design General",
        "language": "en",
        "priority": 2
    },
    {
        "id": "designboom",
        "name": "DesignBoom",
        "url": "https://www.designboom.com/feed/",
        "signal_type": SignalType.WHY,
        "category": "Design General",
        "language": "en",
        "priority": 2
    },
    {
        "id": "dieline",
        "name": "The Dieline",
        "url": "https://thedieline.com/feed/",
        "signal_type": SignalType.WHY,
        "category": "Brand / Packaging",
        "language": "en",
        "priority": 1
    },
]
