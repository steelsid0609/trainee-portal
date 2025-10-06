// src/utils/promoteTempCollege.js
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  writeBatch,
  serverTimestamp,
  getFirestore
} from "firebase/firestore";
import { db } from "../firebase"; // adjust path if needed

const BATCH_LIMIT = 500;

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Promote a colleges_temp document to colleges_master, or link to an existing master.
 * - tempId: id of the temp doc in colleges_temp
 * - adminUid: current admin user's uid (for audit)
 *
 * Returns: { status: 'linked_to_existing'|'promoted', masterId, updated }
 */
export async function promoteTempCollege(tempId, adminUid) {
  if (!tempId) throw new Error("tempId required");
  if (!adminUid) throw new Error("adminUid required");

  const tempRef = doc(db, "colleges_temp", tempId);

  // Transaction: create or find master, mark temp resolved
  const txResult = await runTransaction(db, async (tx) => {
    const tempSnap = await tx.get(tempRef);
    if (!tempSnap.exists()) throw new Error("Temp doc not found");
    const temp = tempSnap.data();
    const name = (temp.name || "").trim();
    if (!name) throw new Error("Temp doc has empty name");

    // Look for existing master using name_lower
    const mastersQ = query(
      collection(db, "colleges_master"),
      where("name_lower", "==", name.toLowerCase())
    );
    const mastersSnap = await getDocs(mastersQ);

    let masterId;
    if (!mastersSnap.empty) {
      // Link to existing master
      masterId = mastersSnap.docs[0].id;
      tx.update(tempRef, {
        resolved: true,
        resolvedBy: adminUid,
        resolvedAt: serverTimestamp(),
        linkedTo: masterId
      });
      return { name, masterId, status: "linked_to_existing" };
    } else {
      // Create new master doc
      const newMasterRef = doc(collection(db, "colleges_master"));
      tx.set(newMasterRef, {
        name,
        name_lower: name.toLowerCase(),
        address: temp.address || "",
        contact: temp.contact || "",
        addedBy: adminUid,
        createdAt: serverTimestamp()
      });
      masterId = newMasterRef.id;
      tx.update(tempRef, {
        resolved: true,
        resolvedBy: adminUid,
        resolvedAt: serverTimestamp(),
        linkedTo: masterId
      });
      return { name, masterId, status: "promoted" };
    }
  });

  // Now update all students that referenced the temp name in batches
  const studentsQ = query(
    collection(db, "students"),
    where("collegeNameTemp", "==", txResult.name)
  );
  const studentsSnap = await getDocs(studentsQ);
  const docs = studentsSnap.docs;
  if (docs.length === 0) {
    return { ...txResult, updated: 0 };
  }

  const chunks = chunkArray(docs, BATCH_LIMIT);
  let totalUpdated = 0;
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((s) => {
      batch.update(s.ref, {
        collegeId: txResult.masterId,
        collegeNameTemp: null,
        collegeTempRef: tempId,
        handledBy: adminUid
      });
      totalUpdated += 1;
    });
    await batch.commit();
  }

  return { ...txResult, updated: totalUpdated };
}
