import * as path from "path";

import * as admin from "firebase-admin";
import { Firestore } from "@google-cloud/firestore";
import * as Storage from "@google-cloud/storage";

function getDb(pathToFbKey: string, projectId: string) {
  const firebaseKey = require(path.resolve(
    path.join(process.cwd(), pathToFbKey)
  ));
  if (firebaseKey.project_id !== projectId) {
    throw Error(
      `Gave projectId ${projectId} but path to firebase key credentials was for ${
        firebaseKey.project_id
      }`
    );
  }
  const app = admin.initializeApp({
    credential: admin.credential.cert(firebaseKey),
    databaseURL: `https://${firebaseKey.project_id}.firebaseio.com`
  });
  return app.firestore();
}

function getStorage(): admin.storage.Storage {
  return admin.storage();
}

function getUsernamePublicVideoRef(
  storage: admin.storage.Storage,
  username: string
): Storage.File {
  return storage.bucket("raha-video").file(`${username}/invite.mp4`);
}

function getUidPublicVideoRef(
  storage: admin.storage.Storage,
  uid: string
): Storage.File {
  return storage.bucket("raha-video").file(`${uid}/invite.mp4`);
}

async function getMemberToUidMap(db: Firestore) {
  const members = (await db.collection("members").get()).docs;
  const memberToUidMap: { [username: string]: string } = {};
  for (let i = 0; i < members.length; ++i) {
    const doc = members[i];
    const username = doc.get("mid");
    if (username === undefined) {
      console.warn(`No mid for member with id: ${doc.id}.`);
    } else {
      memberToUidMap[username] = doc.id;
    }
  }
  return memberToUidMap;
}

async function moveMemberVideos(
  memberToUidMap: {
    [username: string]: string;
  },
  storage: admin.storage.Storage
) {
  for (const username in memberToUidMap) {
    const oldFile = getUsernamePublicVideoRef(storage, username);
    const newFile = getUidPublicVideoRef(storage, memberToUidMap[username]);
    if ((await oldFile.exists())[0]) {
      if (!(await newFile.exists())[0]) {
        try {
          await oldFile.move(newFile);
        } catch (error) {
          console.error(`Error moving ${oldFile.name} to ${newFile.name}`);
        }
        console.log(`moved ${oldFile.name} to ${newFile.name}`);
      } else {
        console.warn(`newfile exists: ${newFile.name}`);
      }
    } else {
      console.warn(`oldfile doesn't exist: ${oldFile.name}`);
    }
  }
}

async function main() {
  const args = process.argv;
  const db = getDb(args[2], args[3]);
  const storage = getStorage();
  const memberToUidMap = await getMemberToUidMap(db);
  await moveMemberVideos(memberToUidMap, storage);
}

main().then(() => {
  process.exit(0);
});
