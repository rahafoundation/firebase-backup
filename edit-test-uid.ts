/**
 * Use this script to change the uid associated with a given member id in the
 * test database. This is useful when using the test database in order to allow
 * logging into existing accounts with your Firebase credentials in the test
 * application, after the database has been restored.
 *
 * For example, could do:
 * npm run edit-test-uid mark.ulrich.2777 vJle6l4K3jdEBk5CvZK4RYyxpFI2
 *
 * to make all member and operations documents associated with mark.ulrich.2777 to have
 * uid vJle6l4K3jdEBk5CvZK4RYyxpFI2. This is useful because the firebase auth UIDs are
 * different in prod and test, so after logging in on test you can see your uid in
 * the firebase authentication tab and then run this script to associate that test uid
 * with a given member id, so then you can log in as that member and view all
 * public data for debugging and development purposes.
 */
import * as firebase from "firebase";
import * as fs from "fs";

/* =======
 * Helpers
 * =======
 */

async function changeUid(
  oldUid: string,
  newUid: string,
  firebaseConfig: any
): Promise<void> {
  const app = firebase.initializeApp(config);
  const db = app.firestore();
  const numEdits = await db.runTransaction(async tx => {
    const membersRef = db.collection("members");
    const opsRef = db.collection("operations");

    const origMember = await membersRef.doc(oldUid).get();
    if (!origMember.exists) {
      throw Error(`Did not find a member with the old UID of ${oldUid}`);
    }
    const opsCreatedByOrig = await opsRef
      .where("creator_uid", "==", oldUid)
      .get();
    const opsToOrig = await opsRef.where("data.to_uid", "==", oldUid).get();

    tx.set(membersRef.doc(newUid), {
      ...origMember.data(),
      ...{ uid: newUid }
    });
    tx.delete(membersRef.doc(oldUid));

    await Promise.all(
      opsCreatedByOrig.docs.map(d =>
        tx.update(opsRef.doc(d.id), { creator_uid: newUid })
      )
    );
    await Promise.all(
      opsToOrig.docs.map(d =>
        tx.update(opsRef.doc(d.id), { "data.to_uid": newUid })
      )
    );
    return 1 + opsCreatedByOrig.docs.length + opsToOrig.docs.length;
  });

  console.log(`Set ${changeMsg} in ${numEdits} places`);
  process.exit();
}

/* ======
 * Script
 * ======
 */

const args = process.argv;

if (args.length !== 4) {
  console.error(
    'Usage is "yarn edit-test-uid oldUid newUid, e.g. skjr93di90j309u3e90jf0ja09j3j vJle6l4K3jdEBk5CvZK4RYyxpFI2". You provided:',
    args
  );
  process.exit(2);
}

const config = require("./firebase.test.config.json");
const oldUid = args[2];
const newUid = args[3];

const changeMsg = `old member UID ${oldUid} to uid ${newUid} in ${
  config.projectId
}`;

console.log(`Going to change ${changeMsg}`);

changeUid(oldUid, newUid, config)
  .then(() => {
    console.info("Setting uid succeeded.");
    process.exit();
  })
  .catch(err => {
    console.error("Setting uid failed.", err);
    process.exit(1);
  });
