/**
 * Add the metadata block including GIVE type to all Give operations. In preparation for tipping functionality.
 */

import * as path from "path";

import * as admin from "firebase-admin";
import {
  Firestore,
  QueryDocumentSnapshot,
  DocumentSnapshot
} from "@google-cloud/firestore";

import { getDb } from "../helpers";
import { request } from "http";

async function addMetadataToGiveOperations(db: Firestore) {
  const giveOperations = (await db
    .collection("operations")
    .where("op_code", "==", "GIVE")
    .get()).docs;
  await Promise.all(
    giveOperations.map(async op => {
      console.log(op.id);
      const opData = op.get("data");
      if ("metadata" in opData) {
        // Skip if it already has metadata.
        return;
      }

      const updatedOpData = {
        ...opData,
        metadata: {
          type: "DIRECT_GIVE",
          memo: opData.memo
        }
      };
      await op.ref.update({
        data: updatedOpData
      });
    })
  );
}

async function main() {
  const args = process.argv;
  const db = getDb(args[2], args[3]);
  await addMetadataToGiveOperations(db);
}

main().then(() => {
  process.exit(0);
});
