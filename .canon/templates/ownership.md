## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
{ #each row in permissions }
| { row.actor } | { row.create } | { row.read } | { row.update } | { row.delete } | { row.notes } |
{ /each }
