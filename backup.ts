import * as util from "util";
import * as fs from "fs";
import * as serialize from "serialize-javascript";
import { getDb } from "./helpers";
import { CollectionReference, Query } from "@google-cloud/firestore";

const writeFile = util.promisify(fs.writeFile);

/* =======
 * Helpers
 * =======
 */

async function storeQueryResult(
  name: string,
  collection: CollectionReference
): Promise<void> {
  let backup: any[] = [];
  let curCollectionView: Query = collection;
  let docs = [];
  while (true) {
    const snapshot = await curCollectionView.get();
    const fetchSize = snapshot.docs.length;
    if (fetchSize === 0) break;

    console.log(`Fetched ${fetchSize} from ${name}`);
    const data = snapshot.docs.map(x =>
      serialize({
        id: x.id,
        data: x.data()
      })
    );
    backup = backup.concat(data);
    const last = snapshot.docs[snapshot.docs.length - 1];
    curCollectionView = collection.startAfter(last);
  }
  await writeFile("./backup." + name + ".serializedJs", backup.join("\n"));
  console.log(`${backup.length} records written for ${name}.`);
}

async function storeAllQueries(collectionsToBackup: {
  [collectionName: string]: CollectionReference;
}): Promise<void> {
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
async function main() {
  console.log("Backing up prod Member and Operation collections.");
  console.log("Arguments: path_to_credentials_file");

  const args = process.argv;
  if (args.length < 3) {
    console.warn(
      "Invalid number of arguments. See usage information above. Exiting."
    );
    return;
  }

  const prodConfig = require("./firebase.prod.config.json");
  const db = getDb(args[2], prodConfig.projectId);

  const collectionsToBackup = {
    operations: db.collection("operations"),
    members: db.collection("members")
  };

  try {
    await storeAllQueries(collectionsToBackup);
    console.info("Back up succeeded.");
    process.exit(0);
  } catch (exception) {
    console.error("Back up failed.", exception);
    process.exit(1);
  }
}

main().then(() => {
  process.exit(0);
});
