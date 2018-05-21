import * as admin from "firebase-admin";
import * as firebase from "firebase";
import * as readline from "readline";
import * as fs from "fs";
import * as util from "util";
import { SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG } from "constants";
import { Query, CollectionReference } from "@google-cloud/firestore";

const readFileAsync = util.promisify(fs.readFile);

function deserialize(serialized: string) {
  return eval(`(${serialized})`);
}

async function deleteAllDocsInCollection(
  collection: CollectionReference
): Promise<number> {
  let curCollectionView: Query = collection;
  let numDeleted = 0;
  while (true) {
    const snapshot = await curCollectionView.get();
    const fetchSize = snapshot.docs.length;
    if (fetchSize === 0) break;

    const last = snapshot.docs[snapshot.docs.length - 1];

    const batch = collection.firestore.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    numDeleted += fetchSize;
    curCollectionView = collection.startAfter(last);
  }
  return numDeleted;
}

async function restoreDatabase(pathToFbKey: string): Promise<void> {
  const firebaseKey = require(pathToFbKey);
  const projectId = "raha-test";
  if (firebaseKey.project_id !== projectId) {
    throw Error(
      `Must use project ${projectId} but path to firebase key credentials was for ${
        firebaseKey.project_id
      }`
    );
  }
  // TODO similar logic in migrations/member-usernames ideally should be more DRY
  const app = admin.initializeApp({
    credential: admin.credential.cert(firebaseKey),
    databaseURL: `https://${projectId}.firebaseio.com`
  });
  const auth = app.auth();
  const db = app.firestore();

  const collectionsToRestore = {
    operations: db.collection("operations"),
    members: db.collection("members")
  };

  let numCollectionsRestored = 0;
  const numCollectionsToRestore = Object.keys(collectionsToRestore).length;

  await Promise.all(
    Object.entries(collectionsToRestore).map(
      async ([collectionName, collection]) => {
        const backupFilename = `./backup.${collectionName}.serializedJs`;
        const backupText = await readFileAsync(backupFilename, "utf8");
        const backupData = backupText
          .split("\n")
          .map(object => deserialize(object));

        const numEntriesToRestore = backupData.length;

        console.log(`Deleting docs from collection ${collectionName}`);
        const numDeleted = await deleteAllDocsInCollection(collection);
        console.log(
          `Deleted ${numDeleted} docs from collection ${collectionName}`
        );

        console.log(`Restoring collection ${collectionName}`);
        await Promise.all(
          backupData.map(entryToRestore => {
            const { id, data } = entryToRestore;
            return collection.doc(id).set(data);
          })
        );

        console.info(
          `Restored ${numEntriesToRestore} entries into collection ${collectionName}`
        );
      }
    )
  );
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt(question: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    rl.question(question, answer => resolve(answer === "y"));
  });
}

async function promptRestoreDatabase(): Promise<boolean> {
  rl.write(
    "This will destroy all data in the test database and restore it from your local backup of the prod db.\n"
  );
  if (
    !(await prompt(
      "Do you have a local backup of the prod db? (If not, run `npm run backup`) (y/n) "
    ))
  ) {
    return false;
  }

  return await prompt(
    "Are you sure you want to delete and restore the test database? (y/n) "
  );
}

async function main() {
  const args = process.argv;

  if (args.length !== 3) {
    console.error(
      "Usage is yarn run restore-test path-to-fb-key. You provided:",
      args
    );
    process.exit(2);
  }

  const confirmed = await promptRestoreDatabase();
  if (!confirmed) {
    console.error("User did not accept; aborting.");
    process.exit(2);
  }

  try {
    await restoreDatabase(args[2]);
    console.info("Restored database.");
    process.exit(0);
  } catch (err) {
    console.error("Migrating member usernames failed.", err);
    process.exit(1);
  }
}

main();
