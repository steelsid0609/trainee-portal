import React, { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function CollegeDropdown({ setSelectedId }) {
  const [cols, setCols] = useState([]);
  useEffect(() => {
    (async () => {
      const q = query(collection(db, "colleges_master"), orderBy("name"));
      const snap = await getDocs(q);
      setCols(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);
  return (
    <select onChange={e => setSelectedId(e.target.value)} defaultValue="">
      <option value="">-- choose college --</option>
      {cols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value="">Other (fill below)</option>
    </select>
  );
}
