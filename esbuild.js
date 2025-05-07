const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const analyze = process.argv.includes('--analyze');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * @type {import('esbuild').Plugin}
 */
const analyzeBundlePlugin = {
  name: 'analyze-bundle',
  setup(build) {
    build.onEnd(async (result) => {
      if (analyze && !result.errors.length) {
        try {
          const { visualizer } = await import('esbuild-visualizer');
          const outdir = path.dirname(build.initialOptions.outfile);
          
          console.log('Generating bundle analysis...');
          await visualizer({
            metafile: result.metafile,
            filename: path.join(outdir, 'bundle-analysis.html'),
            title: 'Auto Header Extension Bundle Analysis',
          });
          console.log('Bundle analysis complete! See dist/bundle-analysis.html');
        } catch (err) {
          console.error('Failed to analyze bundle:', err);
        }
      }
    });
  },
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
    metafile: analyze,
		plugins: [
			esbuildProblemMatcherPlugin,
      analyzeBundlePlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
