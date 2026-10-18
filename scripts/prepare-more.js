'use strict';

/** @deprecated Prefer: node scripts/prepare-extra.js more */
require('./prepare-extra')
  .run('more', process.argv[2])
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
