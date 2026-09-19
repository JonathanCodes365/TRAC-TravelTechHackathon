import random
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from report_features import build_report_feature_vector, REPORT_FEATURE_NAMES

random.seed(42)

# Each event is one real situation, written two ways (as two different people would).
# Several events share a type, so the model learns that two rescue reports are not
# automatically the same rescue: the words and the place have to match too.
EVENTS = {
    "rescue": [
        ("Family of four trapped on a rooftop, water still rising", "Four people stuck on a roof, flood water rising fast"),
        ("Two climbers stuck above the icefall, weather getting worse", "Climbers stranded above the icefall and need help"),
        ("Bus passengers trapped after a landslide hit the road", "Passengers stuck in a bus buried by a landslide"),
        ("Tourists stranded on the trail after the bridge collapsed", "Trekkers cut off on the trail, the bridge is gone"),
    ],
    "injured": [
        ("Trekker with a broken leg at the lodge, needs a stretcher", "Hiker broke his leg near the lodge and can't walk"),
        ("Injured hiker found on the trail", "An injured hiker was located on the trail"),
        ("Porter fell and is bleeding from the head", "A porter is hurt after a fall, head wound"),
    ],
    "missing": [
        ("Lost contact with a solo trekker since yesterday", "Solo trekker missing since yesterday, no contact"),
        ("A trekker named Hari has gone missing", "Missing trekker Hari last seen on the trail"),
        ("Two students did not return from the day hike", "Two students missing after a day hike"),
    ],
    "incident": [
        ("Landslide blocked the main road", "Road blocked due to landslide"),
        ("Bridge damaged by flooding, footpath closed", "Flood damaged the footbridge, the path is closed"),
        ("Avalanche hit the trail near the pass", "Trail near the pass covered by an avalanche"),
    ],
    "safe": [
        ("Group of five confirmed safe after evacuation", "Five people evacuated, all confirmed safe"),
        ("Three tourists were rescued at 4 PM", "Three tourists rescued around 4pm today"),
        ("Our group of 12 reached the shelter, everyone is OK", "Group of twelve safe at the shelter"),
    ],
}
TYPES = list(EVENTS)
LOCATIONS = ["Timure", "Langtang", "Rasuwa", "Tokha", "Kathmandu", "Dhunche",
             "Pokhara", "Ghandruk", "Mugling", "Bhaktapur", "Poon Hill"]
# The same place, written more or less precisely by different people.
PLACE_VARIANTS = {"Pokhara": "Lakeside, Pokhara", "Poon Hill": "Poon Hill, Ghorepani",
                  "Ghandruk": "Ghandruk village", "Kathmandu": "Thamel, Kathmandu"}


def random_time(base_minutes, jitter=0):
    m = base_minutes + random.randint(-jitter, jitter)
    h, mm = divmod(m % (24 * 60), 60)
    return f"2026-09-19T{h:02d}:{mm:02d}:00"


def report(message, rtype, location, time):
    # People often, but not always, name the place in the message, and sometimes
    # leave the place field empty.
    if random.random() < 0.5:
        message = f"{message} near {location}"
    if random.random() < 0.1:
        location = None
    return {"message": message, "type": rtype, "location": location, "time": time}


def make_duplicate_pair():
    # Two people describing the same event: same place, similar words, close in time.
    rtype = random.choice(TYPES)
    first, second = random.choice(EVENTS[rtype])
    loc = random.choice(LOCATIONS)
    loc_b = PLACE_VARIANTS.get(loc, loc) if random.random() < 0.3 else loc
    type_b = rtype if random.random() < 0.9 else random.choice(TYPES)  # reporters sometimes pick another type
    start = random.randint(6 * 60, 22 * 60)
    a = report(first, rtype, loc, random_time(start))
    b = report(second, type_b, loc_b, random_time(start, jitter=60))
    return a, b, 1


def make_non_duplicate_pair():
    # Two different events. In a disaster many separate reports of one kind arrive
    # together, so these are often the same type and close in time.
    if random.random() < 0.2:
        # The same kind of event in two different places, e.g. two separate landslides.
        rtype = random.choice(TYPES)
        message = random.choice(EVENTS[rtype])[0]
        type_a = type_b = rtype
        msg_a = msg_b = message
        loc_a, loc_b = random.sample(LOCATIONS, 2)
    else:
        type_a = random.choice(TYPES)
        type_b = type_a if random.random() < 0.5 else random.choice([t for t in TYPES if t != type_a])
        if type_a == type_b:
            (msg_a, _), (msg_b, _) = random.sample(EVENTS[type_a], 2)
        else:
            msg_a, msg_b = random.choice(EVENTS[type_a])[0], random.choice(EVENTS[type_b])[1]
        loc_a = random.choice(LOCATIONS)
        # Mostly different places; sometimes two separate events in the same town.
        loc_b = loc_a if random.random() < 0.15 else random.choice([l for l in LOCATIONS if l != loc_a])
    start = random.randint(6 * 60, 22 * 60)
    time_b = random_time(start, jitter=60) if random.random() < 0.5 else random_time(random.randint(6 * 60, 22 * 60))
    a = report(msg_a, type_a, loc_a, random_time(start))
    b = report(msg_b, type_b, loc_b, time_b)
    return a, b, 0


def generate_dataset(n=400):
    X, y = [], []
    for _ in range(n):
        a, b, label = make_duplicate_pair()
        X.append(build_report_feature_vector(a, b))
        y.append(label)
    for _ in range(n):
        a, b, label = make_non_duplicate_pair()
        X.append(build_report_feature_vector(a, b))
        y.append(label)
    return np.array(X), np.array(y)


if __name__ == "__main__":
    X, y = generate_dataset(400)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = LogisticRegression()
    model.fit(X_train, y_train)
    print(classification_report(y_test, model.predict(X_test), target_names=["not_duplicate", "duplicate"]))
    for name, weight in zip(REPORT_FEATURE_NAMES, model.coef_[0]):
        print(f"{name:22s} {weight:+.3f}")
    print(f"{'bias':22s} {model.intercept_[0]:+.3f}")

    # Train the saved model on all the data.
    model.fit(X, y)
    joblib.dump(model, "report_model.pkl")
    print("Saved report_model.pkl")
