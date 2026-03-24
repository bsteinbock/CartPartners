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

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
