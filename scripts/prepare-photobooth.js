'use strict';

/** Prepare Photobooth gallery. Prefer: node scripts/prepare-extra.js photobooth */
require('./prepare-extra')
  .run('photobooth', process.argv[2])
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
