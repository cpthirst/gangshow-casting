# The demo show

`pnpm demo` serves the whole app on this made-up show, so you can see the casting rules at work and cause and fix clashes by using the app normally. Every name is invented. There is no real cast data here, and there must never be (CLAUDE.md safeguarding).

- **Addresses:** the app is at http://localhost:5190 and its API at :3190. It runs alongside `pnpm dev` (:5173 and :3000) and never touches its data.
- **Fresh each start:** each start copies `data/` to a temporary folder. Your changes last until you stop the demo (Ctrl+C), and the next start begins from this show again.
- **The show:** 60 cast members across Scouts, Explorers, Network and no section. Two halves of 10 items, each with a length, and a 20-minute interval. Roles of every size, including ensembles of up to 30. Two people have no parts yet, and one role ("Squirrel" in Woodland Dance) is uncast. The Big Opening and Pirate Sketch have made-up scenery files.

## Planted clashes

The show is cast so that these are its only clashes. Everyone else has at least 8 minutes between appearances.

| Kind | Person | Items |
|---|---|---|
| Back-to-back error | Alfie Applebottom | Pirate Sketch → Woodland Dance |
| Back-to-back warning | Zed Applebottom | Space Scouts → Tent Trouble |
| Timing warning | Fen Puddleby | The Lost Map → Explorers' Rap |
| Quick-change info | Pip Kettleby | Night Hike → Thank You Leaders |

The details behind each one:
- **Back-to-back error:** Alfie Applebottom plays Captain Blackbeard (lead) in Pirate Sketch, then Old Oak (support) in Woodland Dance, which comes straight after.
- **Back-to-back warning:** Zed Applebottom plays Mission Control (cameo) in Space Scouts, then is one of the Campers (ensemble) in Tent Trouble, straight after.
- **Timing warning:** Fen Puddleby has 4 minutes off stage, during Semaphore Shuffle, between The Lost Map and Explorers' Rap.
- **Quick-change info:** Pip Kettleby has 6 minutes off stage, during Wide Game, between Night Hike and Thank You Leaders.

## Things to try

- **Clear a clash:**
  - remove Alfie from Old Oak, or move Woodland Dance later in the running order and save;
  - give Mission Control to someone else.
- **Cause a clash:**
  - cast a member of the Opening Chorus in Pirate Sketch, for a back-to-back warning;
  - move Wide Game out from between Night Hike and Thank You Leaders and save, turning Pip's quick change into a back-to-back error.
- **Open and download scenery files:** Production → Overview → Scenery on The Big Opening has made-up files of each kind. `set-plan.pdf`, `stage-layout.png` and `cue-notes.txt` open in a new tab. `build-list.csv` and `lighting-notes.html` download, and the HTML file's script never runs. Pirate Sketch has one file, and every other item has none. To see a file that's gone, delete one from the demo's temporary folder (under `files/2027/itm-01/scenery/`) and then choose its tile.
- **See each permission:** the demo starts as an Admin. Untick Admin under "Local role" in the sidebar, then tick any mix of Casting, Stage, Tech and Wardrobe (or none) to see what that account would see. The demo's API refuses their changes as the live app would.
