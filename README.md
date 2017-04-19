## Configuring TV Account

  1. Add account ID to `tv_config.js`.
  1. Create a new vault and update `tv_config.js`.
  1. Create a new group that grants `CRUD` on `Vault::<created vault id>::Document::$[Owner=self]` and update `tv_config.js`.  We'll call this the "todo user" group.
  1. Create a new group (we'll call it "todo user signup") that grants `C` on `User::` and `C` on `Group::<todo user group id>::GroupMembership::.*`.
  1. Create a new user, and associate it with the "todo user signup" group.
  1. Generate a new API key for that user, update `tv_config.js`.
