### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
{ #each row in events }
| { row.event } | { row.trigger } | { row.actors } | { row.side_effect } |
{ /each }
