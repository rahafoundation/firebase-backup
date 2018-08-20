# firebase-backup

A simple backup tool for operations and members in firestore. Currently specific
to the Raha.io schema. We use this to create json backups of prod db snippets,
then push them all into a test db (which currently requires relaxing test db
firetore.rules). You can also then modify the test uid used to make
authentication work while developing.

## Usage

```sh
yarn install  # install
yarn backup-prod  # back up prod db locally
yarn restore-test # restore test db from local backup
yarn edit-test-uid memberHandle NEW_UID  # change uid for member account in test db, see more below.
```

### Edit your personal test uid.

You can change the uid associated with a given member id in the test database.
This is useful when using the test database in order to allow logging into
existing accounts with your Firebase credentials in the test application, after
the database has been restored.

Easy way: log in to test, then create an issue in this repo with the email you
used to log in and your public member id, we can edit it for you.

Or, if you have sufficient permissions (or have created your own firestore db
and set [`firebase.test.config.json`](firebase.test.config.json) to point
there), can look up your new authentication uid used in the test db so that you
can log in while developing locally. Then, run the command listed above.

### Running migrations

Migrations can be found in the `/migrations` directory and are run manually since
we currently don't have any framework to manage them or version the schema in
Firestore.

Scripts in the directory provide a good example of how one might write a new migration.

Migrations are run by `yarn run ts-node migrations/<script-name>`. Most migrations expect
`[path_to_firebase_credentials] [project_name]` as arguments. See the actual
migration script you are trying to run to confirm.
