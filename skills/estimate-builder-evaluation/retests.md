# Targeted replays

The same requests and contractor answers were used after editing the instructions. Original outputs and grades are unchanged. See the [baseline report](report.md).

## Case 2 — shared instruction revision

**Still incomplete.** Customer copy is marked draft but raises lockset responsibility instead of who supplies flashing and trim consumables.

**Interview:** What exactly did they order for the draft under the front door: a sweep, a slab or a full prehung unit? Can you compare the ordered part to the existing opening and threshold, including clearance as the door swings? That tells us whether it can seal the gap as supplied. Which hardware and trim are you promising to put back?

**Contractor review:** The prehung unit fits the existing opening and the sill is sound. The $950 is labor, including flashing and refitting both sets of trim. Before sending, confirm which lockset the finished door will use and who installs it.

**Homeowner draft:** Draft — Front door replacement
Replace the existing front door with your prehung unit in the same opening. I’ll flash the opening, refit the inside and outside trim, and check that the door swings freely and seals at the threshold. Labor — $950. You supply the unit and handle painting. We still need to confirm the lockset and who will install it.

## Case 10 — shared instruction revision

**Pass.** Placement explicitly depends on fireplace clearance and cord reach.

**Interview:** At the owner’s chosen position above the mantel, have you verified suitable backing, bracket fit and the clearance the TV and fireplace require? For the wires, will they accept a visible cord cover to the existing outlet, or do they want everything concealed behind the TV? Where are power and the signal source now, and who would provide a new outlet if needed?

**Contractor review:** Backing and bracket are settled, and the owner accepted the visible cover. Before booking, verify the mantel location meets the TV and fireplace clearances and the cords reach through the proposed cover to the existing connections. The $220 is for mounting and the surface raceway only.

**Homeowner draft:** Draft — TV mounting over the mantel
Mount your TV on the supplied bracket and run the cords in a visible, paintable surface cover. Price — $220 for mounting and the cover. Final placement depends on confirming fireplace clearance and cord reach to the existing connections. The outlet stays in place and the cords stay outside the wall.

## Case 41 — shared instruction revision

**Pass.** Draft retains $1,800 labor and makes hookup, footprint and supply decisions visible.

**Interview:** What would the owner point to when this refresh is finished: new fixtures, paint, flooring or a particular combination? Which items stay, and who supplies the replacements? If a vanity or mirror changes size, can you check the old outline so you know how much exposed wall or floor finish the job needs? I’d keep the existing shower intact.

**Contractor review:** Your $1,800 covers your labor on the vanity, mirror and wall paint. The owner’s electrician handles the light separately. Confirm whether the vanity fits the old footprint without exposing unfinished flooring, who reconnects the sink, and who supplies paint before sending.

**Homeowner draft:** Draft — Bathroom refresh
Install your new mirror and vanity in the existing vanity location and paint the bathroom walls. My fixed labor price is $1,800. We’ll confirm the vanity’s fit over the existing floor, who reconnects the sink and who supplies the paint before booking. The shower and flooring stay in place. You supply the mirror, vanity and light and pay your electrician directly for the light replacement.

## Case 42 — shared instruction revision

**Pass.** Draft identifies still-unmarked demolition limits and tile surfaces before acceptance.

**Interview:** Which part of the gut and rebuild are you personally quoting, and in what condition will you receive and hand back the room? For the tiled shower, who owns the pan, waterproofing and testing before tile goes on? What surfaces and quantities are in your price, and has anyone confirmed the fixture layout or a plan for bathroom access while it’s out of use?

**Contractor review:** Keep the $4,600 together for demolition and tile, with hauling included. Have the GC or owner mark the demolition limits and the surfaces to be tiled, particularly the shower walls, shower floor and bathroom floor. The GC’s signed-off waterproofing is the starting point for your shower tile.

**Homeowner draft:** Draft — Bathroom demolition and tile installation
My lump sum is $4,600 for the agreed demolition and tile installation together, including haul-away of demolition debris. Before acceptance, we’ll mark what comes out and exactly which shower and bathroom surfaces receive tile. You buy the tile. I’ll start shower tiling after the GC hands over the signed-off waterproofed substrate. Others handle plumbing and glass.

## Case 43 — shared instruction revision

**Pass.** The $2,500 is attached to installing 18 fronts; supply remains open in customer copy.

**Interview:** How many doors and drawer fronts are changing, who supplies the new fronts and hardware, and what finish will the exposed boxes keep? For the countertops, who removes the old top, templates and installs the new one, then reconnects the sink? Can the old top clear any backsplash the owner expects to keep?

**Contractor review:** The $2,500 covers installing 18 fronts and their hardware. Confirm who supplies the fronts and hardware, and whether old-top removal or sink disconnection needs separate arrangements before the fabricator arrives. Keep the fabricator’s price separate.

**Homeowner draft:** Draft — Cabinet door front replacement
Install 18 new cabinet door fronts and their hardware on your existing boxes for $2,500. We’ll confirm who supplies the fronts and hardware before booking. The boxes and appliances stay in place. Your fabricator bills you separately for the countertops. My work does not include measuring or installing them. Responsibility for removing the old tops and disconnecting the sink still needs confirmation.

## Case 60 — shared instruction revision

**Pass.** The $330 draft makes trench/backfill readiness and responsibility explicit.

**Interview:** How large is the bare strip, and has the plumbing crew finished backfilling it? Check whether the soil is firm and at the right height to meet the existing lawn once the sod is down. Who will handle any leveling, supply the sod and water it after installation?

**Contractor review:** The strip is measured and the limit is marked. Is the trench backfilled and ready for ordinary surface prep, or does it still need fill or settlement correction? Confirm that handoff before sending the price as final.

**Homeowner draft:** Marked trench sod repair — draft

I’ll prepare and sod the measured 90 sq ft within the marked plumbing trench and water it once. The price for prep, sod and that first watering is $330. Before scheduling, we’ll confirm the trench backfill is ready for that surface work and agree who handles any remaining backfill. You’ll water the new sod after the first watering.

## Case 90 — shared instruction revision

**Pass.** Structured interview asks before making a commitment; later customer record carries a draft status and one $150 labor price.

**Interview:** 
```json
{
  "contractor_review": {
    "questions": [
      "Are the two new bars and the paper holder going in their current locations? Check the new brackets against the existing holes and backing. Will they mount securely and cover the old marks?",
      "Who supplies the hardware, and is any patching or painting part of the price?"
    ]
  }
}
```

**Contractor review:** 
```json
{
  "contractor_review": {
    "changes": [
      "All three accessories are owner-supplied. Backing is verified, and one labor price covers all three."
    ],
    "open_items": [
      "Do the new brackets cover the old mounting marks? Confirm the finish handoff if holes will remain visible."
    ]
  }
}
```

**Homeowner draft:** 
```json
{
  "customer": {
    "title": "Bathroom accessory replacement",
    "result": "Replace two towel bars and one toilet paper holder.",
    "readiness": "Draft — confirm the finish around the old mounting points.",
    "pricing": {
      "group": "Accessory replacement labor",
      "status": "supplied_fixed",
      "wording": "$150 lump sum, labor only",
      "coverage": "Replace all three owner-supplied accessories."
    },
    "items": [
      {
        "type": "included",
        "description": "Remove the existing towel bars and mount the replacements at the verified backing.",
        "quantity": 2,
        "unit": "towel bars",
        "quantity_status": "contractor-confirmed",
        "responsibility": "contractor",
        "pricing": {
          "status": "included_in_bundle",
          "group": "Accessory replacement labor"
        }
      },
      {
        "type": "included",
        "description": "Remove the existing toilet paper holder and mount its replacement at the verified backing.",
        "quantity": 1,
        "unit": "paper holder",
        "quantity_status": "contractor-confirmed",
        "responsibility": "contractor",
        "pricing": {
          "status": "included_in_bundle",
          "group": "Accessory replacement labor"
        }
      },
      {
        "type": "owner_action",
        "description": "Supply both replacement towel bars and the paper holder.",
        "responsibility": "owner"
      },
      {
        "type": "boundary",
        "description": "We’ll confirm whether the replacement brackets cover the old marks and agree on the finish of any visible holes before installation."
      }
    ]
  }
}
```

## Case 2 — door playbook revision

**Pass.** After the door-specific revision, the $950 remains labor-only and material-supply responsibility is explicitly pending.

**Interview:** What did they order, a replacement sweep, a door slab, or a prehung door with its frame? Where do you find the gap when the door is latched? If it’s a prehung unit, have you checked the opening, jamb depth, sill height and trim footprint against the actual unit? That tells us whether a same-opening installation will close the gap and what trim can go back. What materials will arrive with the door, and who is supplying flashing, sealant and any trim stock needed?

**Contractor review:** Fit is verified and the sill is sound. Before sending, confirm who supplies the flashing, sealant and any trim stock needed beyond the pieces being refitted. The $950 covers installation labor.

**Homeowner draft:** Front entry door replacement — draft
I’ll remove the existing unit, install your prehung door in the same opening, flash and seal it, and refit the interior and exterior trim. I’ll check the swing, latch and seal at the threshold. You’ll supply the door unit and handle painting.
Installation labor — $950, including the flashing work and trim refitting. Before we finalize the estimate, we’ll agree who supplies the flashing, sealant and any additional trim stock needed.
