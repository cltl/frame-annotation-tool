# FrameNet input to tool

This directory contains two files:
* **lu_to_frames.json**
* **frame_to_info.json**
* **event_type_to_dominant_frame.json**

The files in this directory are created using:
https://github.com/cltl/FN_Reader/blob/master/tool_utils.py

## **lu_to_frames.json**

In this current version, a **lemma** is mapped to its candidate frame IDs according to FrameNet 1.7, e.g.,

```json
"sail": [
    "64",
    "65",
    "690"
],
"sailor": [
    "2670"
],
```

## **frame_to_info.json**

In this current version, a frame ID is mapped to its definition, and role information, e..g,
```json
    "3015": {
        "definition": "This frame refers to a part of an organization that becomes separate from the main body. The part is usually partially or even wholly autonomous, and may eventually become larger than the body from which it originated.   'Methodism is an an offshoot of the Church of England' ",
        "frame_label": "Offshoot",
        "roles": [
            {
                "role_definition": "The body from which the Offshoot is derived.",
                "role_id": "16857",
                "role_label": "Original_body",
                "role_type": "Peripheral"
            },
            {
                "role_definition": "The offshoot or branch of the original body which differs from it in some important respect.",
                "role_id": "16858",
                "role_label": "Branch",
                "role_type": "Core"
            },
            {
                "role_definition": "The place in which the Branch is locate or where it first forms.",
                "role_id": "16859",
                "role_label": "Place",
                "role_type": "Peripheral"
            },
            {
                "role_definition": "The time at which the Branch forms or thrives.",
                "role_id": "16860",
                "role_label": "Time",
                "role_type": "Peripheral"
            }
        ]
    },
```

## **event_type_to_dominant_frame.json**
This file contains information about the main frames of an event, the subframes, and dominant frames for relevant lexical units, e.g.,

```json 

"Q132821": {
    "event_label" : "murder",
    "main_frame_ids": [
            590,
            432
        ],
    "subframe_ids": [
            290,
            485,
            426,
            93,
            112,
            115,
            53,
            384,
            470
        ],
    "lu_to_dominant_frame": {
            "accident": 115,
            "altercation": 93,
            "annihilate": 590,
            "annihilation": 590,
            "apocalypse": 115,
            "armed": 470,
            "arms": 426,
            "arsenal": 426,
            "arson": 432,
        ....
    }
...

```

## Considerations
* do we use the part of speech in the look-up and if so NAF or Universal Dependencies?
* what kind of identifiers do we use for FrameNet lexical units, roles, and frames? Framester or other one.
* how do we vizualize the information to the annotators? Which information do we show?
* how do deal with multiword expressions? How do we represent them?