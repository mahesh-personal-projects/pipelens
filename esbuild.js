const esbuild = require('esbuild')

const isProduction = process.argv.includes('--production')
const isWatch = process.argv.includes('--watch')

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
}

if (isWatch) {
  esbuild.context(options).then(ctx => {
    ctx.watch()
    console.log('Watching extension source…')
  })
} else {
  esbuild.build(options)
}
