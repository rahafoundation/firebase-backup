import * as firebase from "firebase";
import * as util from "util";
import * as fs from "fs";

const writeFile = util.promisify(fs.writeFile);

/* =======
 * Helpers
 * =======
 */

async function storeQueryResult(
  name: string,
  collection: firebase.firestore.CollectionReference
): Promise<void> {
  let backup: any[] = [];
  let curCollectionView: firebase.firestore.Query = collection;
  while (true) {
    const snapshot = await curCollectionView.get();
    const fetchSize = snapshot.docs.length;
    if (fetchSize === 0) break;

    console.log(`Fetched ${fetchSize} from ${name}`);
    const data = snapshot.docs.map(x =>
      JSON.stringify({
        id: x.id,
        data: x.data()
      })
    );
    backup = backup.concat(data);
    const last = snapshot.docs[snapshot.docs.length - 1];
    curCollectionView = collection.startAfter(last);
  }
  await writeFile("./backup." + name + ".json", backup.join("\n"));
  console.log(`${backup.length} records written for ${name}.`);
}

async function storeAllQueries(): Promise<void> {
  await Promise.all(
    Object.entries(collectionsToBackup).map(([name, collection]) =>
      storeQueryResult(name, collection)
    )
  );
}

/* ======
 * Script
 * ======
 */

const prodConfig = require("./firebase.prod.config.json");
firebase.initializeApp(prodConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const collectionsToBackup = {
  operations: db.collection("operations"),
  members: db.collection("members")
};

storeAllQueries()
  .then(() => {
    console.info("Back up succeeded.");
    process.exit();
  })
  .catch(err => {
    console.error("Back up failed.", err);
    process.exit(1);
  });
