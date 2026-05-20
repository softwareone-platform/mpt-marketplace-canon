### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |
{ #each row in transitions }
| { row.id } | { row.from } | { row.to } | { row.action } | { row.actors } | { row.preconditions } | { row.outcome } |
{ /each }
