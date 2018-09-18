/**
 * Add the BasicIncome type to all Mint operations. In preparation for the ReferralBonus Mint type.
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

async function addBasicIncomeTypeToMintOperations(db: Firestore) {
  const mintOperations = (await db
    .collection("operations")
    .where("op_code", "==", "MINT")
    .get()).docs;
  await Promise.all(
    mintOperations.map(async op => {
      console.log(op.id);
      const opData = op.get("data");
      opData.type = "BASIC_INCOME";
      await op.ref.update({
        data: opData
      });
    })
  );
}

async function main() {
  const args = process.argv;
  const db = getDb(args[2], args[3]);
  await addBasicIncomeTypeToMintOperations(db);
}

main().then(() => {
  process.exit(0);
});
