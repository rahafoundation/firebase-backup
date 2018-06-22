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
  memberId: string,
  newUid: string,
  firebaseConfig: any
): Promise<void> {
  const app = firebase.initializeApp(config);
  const db = app.firestore();
  const numEdits = await db.runTransaction(async tx => {
    const membersRef = db.collection("members");
    const opsRef = db.collection("operations");
    const origMember = await membersRef.where("mid", "==", memberId).get();
    const numOrig = origMember.docs.length;
    if (numOrig !== 1) {
      throw Error(
        `Found ${numOrig} members with mid of ${memberId}, but expected exactly 1`
      );
    }
    const ops_created_by_orig = await opsRef
      .where("creator_mid", "==", memberId)
      .get();
    const ops_to_orig = await opsRef.where("data.to_mid", "==", memberId).get();
    tx.set(membersRef.doc(newUid), {
      ...origMember.docs[0].data(),
      ...{ uid: newUid }
    });
    tx.delete(membersRef.doc(origMember.docs[0].id));
    await Promise.all(
      ops_created_by_orig.docs.map(d =>
        tx.update(opsRef.doc(d.id), { creator_uid: newUid })
      )
    );
    await Promise.all(
      ops_to_orig.docs.map(d =>
        tx.update(opsRef.doc(d.id), { "data.to_uid": newUid })
      )
    );
    return 1 + ops_created_by_orig.docs.length + ops_to_orig.docs.length;
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
    'Usage is "yarn edit-test-uid memberHandle newUid, e.g. mark.ulrich.2777 vJle6l4K3jdEBk5CvZK4RYyxpFI2". You provided:',
    args
  );
  process.exit(2);
}

const config = require("./firebase.test.config.json");
const memberId = args[2];
const newUid = args[3];

const changeMsg = `member ID ${memberId} to uid ${newUid} in ${
  config.projectId
  }`;

console.log(`Going to change ${changeMsg}`);

changeUid(memberId, newUid, config)
  .then(() => {
    console.info("Setting uid succeeded.");
    process.exit();
  })
  .catch(err => {
    console.error("Setting uid failed.", err);
    process.exit(1);
  });
