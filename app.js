/*
 * LiskHQ/lisk-explorer
 * Copyright © 2018 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */
const express = require('express');
const proxy = require('http-proxy-middleware');
const request = require('request-promise');
const path = require('path');
const compression = require('compression');
const methodOverride = require('method-override');

const packageJson = require('./package.json');
const logger = require('./logger.js');
const config = require('./config.js');

const app = express();

app.set('version', packageJson.version);
// app.set('strict routing', true);

app.use((req, res, next) => {
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-XSS-Protection', '1; mode=block');

	/* eslint-disable */
	const connectSrc = `ws://${req.get('host')} wss://${req.get('host')}`;
	const contentSecurityPolicy = [
		`default-src 'self';`,
		`frame-ancestors 'none';`,
		`connect-src 'self' ${connectSrc} https://www.google-analytics.com https://*.crazyegg.com;`,
		`img-src 'self' https:;`,
		`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;`,
		`script-src 'self' 'unsafe-eval' 'unsafe-inline' https://tagmanager.google.com/ https://www.googletagmanager.com/ https://www.google-analytics.com/ https://dnn506yrbagrg.cloudfront.net/ https://*.ipify.org/ https://*.crazyegg.com/ http://trk.cetrk.com/ https://s3.amazonaws.com/trk.cetrk.com/;`,
		`font-src 'self' https://fonts.gstatic.com data:`,
	].join(' ');
	/* eslint-enable */

	res.setHeader('Content-Security-Policy', contentSecurityPolicy);
	return next();
});

const serverHealthCheck = async () => {
	try {
		const res = await request(`${config.apiUrl}/api/status`);
		const version = JSON.parse(res).version;
		logger.info(`Connected to ${config.apiUrl}, Lisk Service version ${version}`);
	} catch (err) {
		logger.info(`The ${config.apiUrl} is unavailable or is not a proper Lisk Service endpoint.\nConsider setting SERVICE_ENDPOINT="https://service.lisk.io"`);
	}
};

serverHealthCheck();

app.get('/api/ui_message', (req, res) => {
	const msg = config.uiMessage;
	const now = new Date();

	if (msg && msg.text) {
		const start = msg.start ? new Date(msg.start) : null;
		const end = msg.end ? new Date(msg.end) : null;
		if ((!start || (now >= start)) && (!end || (now < end))) {
			return res.json({ success: true, content: msg.text });
		}
	}

	return res.json({ success: false, error: 'There is no info message to send' });
});

const defaultProxyConfig = {
	logLevel: config.log.level || 'debug',
	target: config.apiUrl,
};

// HTTP proxy
app.use('/api', proxy(Object.assign({}, defaultProxyConfig, {
	changeOrigin: true,
})));

// WebSocket proxy
const wsProxy = proxy(Object.assign({}, defaultProxyConfig, {
	changeOrigin: true,
	ws: true,
}));
app.use('/socket.io', wsProxy);

app.use(express.static(path.join(__dirname, 'public')));
app.use(compression());
app.use(methodOverride('X-HTTP-Method-Override'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const server = app.listen(config.port, config.host);
server.on('upgrade', wsProxy.upgrade);
