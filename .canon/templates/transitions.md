### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
{ #each row in transitions }
| { row.id } | { row.from } | { row.to } | { row.action } | { row.endpoint } | { row.actors } | { row.preconditions } | { row.outcome } |
{ /each }
