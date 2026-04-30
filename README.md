# CartPartners

CartPartners is a mobile application designed to help you stay connected with your golfing buddies by ensuring that your cart partners change from round to round. The app supports organizing players into leagues or outings, managing player availability, creating rounds, generating tee-time groups, and sending notifications to players via email or text message.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## App Features

CartPartners provides a comprehensive set of features organized into tabs and drawer screens for easy navigation and management of golf outings.

### Main Tabs

#### Rounds Tab

The Rounds tab displays all your defined rounds and includes a button to add a new round. Key features include:

- **League/Outing Picker**: The picker at the very top of the screen allows you to select a specific league or outing
- **Round Management**:
  - Long-press on a round to edit its details (course, date, and tee-time information)
  - Swipe left on a round to edit it or to delete it and all associated data
  - Tap a round to open its Lineup tab
- **Round Details**: Each round is defined by specifying the course, date, and tee-time information, which will appear in announcements sent to players
- **CSV Import**: Import multiple rounds at once from a CSV file. The file must contain `Course` and `Date` columns; an optional `TeeTimeInfo` column is also supported. Use the "Get Sample CSV" button to download a pre-formatted template

#### Lineup Tab

Use the Lineup tab to specify the players participating in a particular round. Features include:

- **Round Selection**: The picker at the top shows the current round and allows you to select a different one
- **Player Management**:
  - View all golfers whose status is set to "available"
  - Tap the icon at the top right to add players from the master player list
  - Toggle player participation for the selected round
- **Navigation**: Once the lineup is finalized, press the Groups icon at the bottom to open the Groups tab

#### Groups Tab

Create and manage the tee-time groupings for a round. Features include:

- **Group Generation**:
  - Press "Generate" to create groups for the first time
  - Press "Regenerate" to update existing groups
  - The algorithm ensures cart partners change from round to round
- **Group Management**:
  - Select a group to access edit and reordering options
  - Move groups up or down in the tee-time order
  - Use the icon at the top right to manually adjust players in any group
  - Swap players between groups as needed
- **Communication**: Use the airplane icon to send an email to all players informing them of their groups

#### More Tab

The More tab provides access to additional screens through a drawer navigation panel. Open the drawer by tapping the icon at the top left of the screen.

### Drawer Screens

The More tab includes the following screens accessible via the drawer menu:

#### Notify Players

Send notifications to players via email or text message. Features include:

- **Player Selection**: Choose which players to notify from the current league's player list
- **Message Composition**: Enter a custom title and message
- **Delivery Options**: Send via email or SMS (when available)
- **Call a Player**: Players with a mobile number on file show a chevron indicator. Swipe left on a player row to reveal a call button that opens the phone app directly for that player
- **League Context**: The player list is specific to the currently active league

#### Leagues/Outings

Manage multiple leagues or outings, each with its own set of players and rounds. Features include:

- **Create Leagues**: Add new leagues or outings with custom names
- **Edit Leagues**: Long-press to edit league details
- **Delete Leagues**: Swipe left to remove a league
- **Multiple Contexts**: Maintain separate player lists and rounds for different groups

#### League Players

Define the list of players specific to a particular league or outing. Features include:

- **Add Players**: Add players from the master player list to the current league
- **Remove Players**: Swipe to delete players from the league (doesn't delete from master list)
- **Export**: Export the league's player list to a CSV file for use in other applications
- **League Selection**: Choose which league to manage using the picker at the top

#### Manage All Players

Manage the master player list containing all players known to the app. Features include:

- **Add Players**: Create new player entries with name, email, and phone information
- **Edit Players**: Modify player details including availability status
- **Delete Players**: Remove players from all leagues, rounds, and groups
- **Import/Export**:
  - Import players from a CSV file
  - Export the entire player list to CSV for backup or sharing
- **Universal List**: All players regardless of league association

#### Backup/Restore

Create and restore database backups containing all CartPartners data. Features include:

- **Backup**: Create a database file with all your leagues, players, rounds, and groups
- **Restore**: Load data from a previous backup file
- **Sharing**: Share backup files with another person taking over as Group Coordinator
- **Warning**: Restoring a backup will overwrite all existing data in the app

#### About

View app information, configure settings, and access licenses. Features include:

- **App Version**: Display current version and build information
- **Documentation**: Comprehensive overview of all app features
- **Settings**:
  - Toggle "Use CC for Multiple Recipients" for email compatibility
  - Supports email clients like Yahoo Mail that only allow a single "To" recipient
- **Open Source Licenses**: View licenses for all dependencies

## Development

### Project Structure

```
app/
├── (tabs)/              # Main tab navigation
│   ├── (rounds)/        # Rounds management
│   ├── groups/          # Group management
│   ├── lineup.tsx       # Player lineup
│   └── more/            # Drawer navigation
│       ├── message.tsx  # Notify Players
│       ├── leagues.tsx  # Leagues/Outings
│       ├── leagueplayers.tsx  # League Players
│       ├── players/     # Manage All Players
│       ├── backup.tsx   # Backup/Restore
│       └── about.tsx    # About & Settings
```

### Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Group Generation Algorithm

CartPartners uses a multi-trial greedy algorithm with post-generation local swap optimization to build tee-time groups that maximize variety — so players meet new cart partners each round instead of repeating the same pairings.

### Original Algorithm

The original algorithm scored each candidate player using two components added together:

```
score(candidate) = (uniquePartnerCount × fairnessWeight)
                 + Σ repeatsWith(candidate, currentGroupMember)
```

- **uniquePartnerCount** — how many distinct players this candidate has played with across all prior rounds
- **fairnessWeight** — a configurable multiplier (default `1.0`)
- **repeatsWith** — how many times this candidate has already played with each player already placed in the current group

The candidate with the **lowest score** was selected at each step (fewest overall connections and fewest repeats with the current partial group).

#### Problem with the original

With a 37-player league the fairness baseline ranged from **0 to 36** (one point per distinct prior partner), while the repeat-interaction term ranged from only **0 to 3** (rounds played so far). Because the baseline term dominated the score:

- **Newcomers** (few prior partners → baseline ≈ 0) always scored lowest and were pulled into the same groups together.
- **Veterans** (many prior partners → baseline ≈ 36) were left until last and forced into the remaining slots with the same other veterans, round after round.
- A repeat pairing only added a penalty of +1–3, not enough to outweigh the baseline difference between two candidates.

In practice this caused specific pairs to accumulate repeats well before those players had rotated through the full available pool.

---

### Improvement 1 — Dominant repeat weight

The first fix introduces a `repeatWeight` multiplier applied exclusively to the repeat-interaction component:

```
repeatWeight = playerIds.length          // e.g. 37

score(candidate) = (uniquePartnerCount × fairnessWeight)
                 + Σ repeatsWith(candidate, currentGroupMember) × repeatWeight
```

With `repeatWeight = 37`, a single repeat pairing adds **+37** — more than the entire possible fairness-baseline range of 0–36. This creates a strict priority ordering:

1. **Never repeat a pairing** if any zero-repeat candidate exists.
2. Among equal repeat counts, use the fairness baseline as a tie-breaker.

---

### Improvement 2 — Participation normalization and part-timer distribution

When some players only attend a fraction of rounds, a raw `uniquePartnerCount` baseline is biased: a part-timer with 4 rounds has far fewer distinct partners than a full-timer with 10 rounds, so part-timers always score lower and cluster together.

Two coordinated fixes address this:

**Normalize the fairness baseline by participation count**

```
score(candidate) = (uniquePartnerCount / roundsPlayed) × fairnessWeight
                 + Σ repeatsWith(candidate, currentGroupMember) × repeatWeight
```

A part-timer with 10 unique partners in 4 rounds scores `2.5`; a full-timer with 28 partners in 10 rounds scores `2.8`. The scores are now comparable regardless of attendance frequency.

**Participation-mix bonus**

When selecting the next player to add to a partially-built group, a bonus rewards candidates whose round count differs from the group's current average:

```
effectiveScore = candidateScore − |groupAvgParticipation − candidate.roundsPlayed| × 0.5
```

This actively pulls part-timers toward groups that already contain full-timers. The weight `0.5` is small enough that the +37 repeat penalty can never be overridden.

**Veteran-anchored starter selection**

Each group is seeded with the most experienced player (highest `roundsPlayed`) rather than the least connected. This spreads one veteran across every group as an anchor; newcomers are then drawn toward those veteran-seeded groups via the participation-mix bonus rather than clustering into newcomer-only groups.

`roundParticipation` (a map of `playerId → rounds attended`) is computed from the `round_players` table and passed as an optional parameter. If omitted, all players default to `1` round, preserving previous behavior.

---

### Improvement 3 — Multi-trial generation with local swap optimization

Even after the scoring improvements, a single greedy pass is inherently **myopic**: once a high-repeat pair happens to land in the same early group, there is no way to undo it. In small lineups (e.g. 15 players) this causes specific pairs or triples — such as Bill S + Ed M, or Carl C + Bernie B + Garry M — to recur significantly more often than chance would predict.

The current algorithm solves this with two complementary techniques:

#### Multi-trial random restarts

`generateGroupsForRound` runs the greedy algorithm **5 times**, each time with an independently shuffled player order. Because the greedy algorithm is deterministic given its input order, different shuffles produce genuinely different group arrangements. All 5 candidates are scored and the best one is kept.

```
for trial in 1..5:
    shuffledPlayers = shuffle(playerIds)          // fresh random order each trial
    candidate       = buildGreedyGroups(shuffledPlayers, ...)
    improved        = localSwapImprove(candidate, partnerFrequencies)
    score           = scoreGroupArrangement(improved, partnerFrequencies)

return the candidate with the lowest score
```

When `shuffle: false` is passed, only 1 trial runs without shuffling, preserving fully deterministic behavior for callers that require it.

#### Local pairwise swap improvement

After each greedy pass, `localSwapImprove` is applied. It considers every possible swap of one player from group _A_ with one player from group _B_ and accepts the swap whenever it reduces the **quadratic penalty score**:

```
scoreGroupArrangement = Σ freq(a, b)²   for every same-group pair (a, b)
```

The quadratic penalty means a pair grouped together 3 times (cost = 9) is penalized far more harshly than three distinct pairs grouped once each (cost = 1 + 1 + 1 = 3). This makes high-repeat pairs the primary target of every swap pass.

The swap loop repeats until a full pass over all group pairs finds no improving swap, guaranteeing convergence. The score can never increase — any arrangement returned by `localSwapImprove` is at least as good as its input.

#### Why the combination is effective

- **Multi-trial** escapes global structure problems: a bad greedy ordering that places a high-repeat pair in group 1 from the start can be avoided by a different shuffle in another trial.
- **Local swaps** escape local structure problems: even the best greedy result may have a high-repeat pair that a single swap can fix without disturbing the rest of the arrangement.
- Together they reduce worst-case repeat pairings from ~8× per 60-round season (without optimization) to ~6× while keeping runtime well under 1 second for lineups up to 40 players.

#### Strict penalty priority ordering

All three improvements maintain a clear dominance hierarchy so no lower-priority objective can accidentally override a higher one:

| Priority    | Mechanism                                      | Magnitude                |
| ----------- | ---------------------------------------------- | ------------------------ |
| 1 (highest) | Repeat penalty (`repeatWeight = N`)            | +37 per repeat           |
| 2           | Local swap quadratic score (post-processing)   | reduces existing repeats |
| 3           | Participation-mix bonus                        | −0 to −3 per candidate   |
| 4 (lowest)  | Fairness baseline (normalized unique partners) | 0 to ~3                  |

#### Additional constraints

- **Slow-pair avoidance**: players whose `speedIndex` exceeds a configurable threshold are not placed together unless no other option exists.
- **Post-processing slow-cluster swap**: after the winning arrangement is selected, a separate greedy swap step reduces slow-player clusters while bounding any increase in repeat pairings.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
