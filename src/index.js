'use strict';

var phantom = require('phantom');
var Totals = require('./Totals');
var Alerts = require('./Alerts');
var Checklists = require('./Checklists');
var Targets = require('./Targets');
var request = require('request-promise');
var cheerio = require('cheerio');
var extract = require('url-querystring');

var parseListResponse = (html) => {
    var $ = cheerio.load(html);
    var trs = $('#content table tr');
    var results = [];
    trs.each((i, elem) => {
        var tds = $(elem).find('td');
        if (tds.length == 5) {
            var row = $(tds[0]).text();
            var speciesTd = $(tds[1]);
            var name = speciesTd.text().split(' - ');
            var speciesLink = speciesTd.find('a').attr('href');
            var speciesCode = extract(speciesLink).qs.spp;

            var location = $(tds[2]).text();
            var sp = $(tds[3]).text();
            var date = $(tds[4]).text();
            results.push({
                rowNumber: row,
                commonName: name[0],
                scientificName: name[1],
                location: location,
                sp: sp,
                date: date,
                speciesCode: speciesCode,
            });
        }
    });

    return results;
};

class ebird {
    constructor(sessionToken) {
        this.session = sessionToken;
        this.bindTo('totals', Totals);
        this.bindTo('alerts', Alerts);
        this.bindTo('checklists', Checklists);
        this.bindTo('targets', Targets);
    }

    bindTo(key, object) {
        this[key] = {};
        for (var name in object) {
            this[key][name] = object[name].bind(this);
        }
    }

    auth(username, password) {
        if (this.session) {
            return request({
                uri: 'http://ebird.org/ebird/prefs',
                headers: {
                    'Cookie': `EBIRD_SESSIONID=${this.session}`
                },
                followRedirect: false,
                resolveWithFullResponse: true,
            }).then((response) => {
                if (response.statusCode == 200) {
                    return this.session;
                } else {
                    throw 'Not authed';
                }
            }).catch(err => {
                return this.authWithPassword(username, password);
            });
        } else {
            return this.authWithPassword(username, password);
        }
    }

    authWithPassword(username, password) {
        return new Promise((resolve, reject) => {
            phantom.create().then(ph => {
                ph.createPage().then(page => {
                    return page.open('https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Febird%2Flogin%2Fcas%3Fportal%3Debird').then(() => {
                        page.on('onLoadFinished', function() {
                            page.property('cookies').then(cookies => {
                                var value = '';
                                cookies.forEach(function(cookie) {
                                    if (cookie.name == 'EBIRD_SESSIONID') {
                                        value = cookie.value;
                                    }
                                });
                                ph.exit();
                                if (value) {
                                    resolve(value);
                                } else {
                                    reject();
                                }
                            });
                        });
                        page.evaluate(function(username, password) {
                            document.getElementById('input-user-name').value = username;
                            document.getElementById('input-password').value = password;
                            document.getElementById('credentials').submit();
                        }, username, password);
                    });
                });
            });
        }).then((value) => {
            this.session = value;
            return value;
        });
    }

    list(code, time, year, opts) {
        opts = opts || {};
        var options = {
            sortKey: opts.sortKey || 'taxon_order',
            o: opts.o || 'asc',
        };
        var lowerCaseCode = code.toLowerCase();
        var customList = [
            'aba',
            'poc',
            'world',
            'whs',
            'ehs',
            'north_america',
            'south_america',
            'cen',
            'caribbean',
            'aou',
            'lower48',
            'wpa',
            'eur',
            'asia',
            'eus',
            'afr',
            'saf',
            'aus',
            'aut',
            'spo',
            'aoc',
            'ioc',
        ];
        let qs = {
            cmd: 'list',
            listType: code,
            time: time,
            sortKey: options.sortKey,
            o: options.o,
            year: year,
        };

        if (customList.indexOf(lowerCaseCode) != -1) {
            code = lowerCaseCode;
            qs.listCategory = 'default';
        }
        return request({
            uri: 'http://ebird.org/ebird/MyEBird',
            qs: qs,
            headers: {
                'Cookie': `EBIRD_SESSIONID=${this.session}`
            },
        }).then(parseListResponse);
    }
}

module.exports = ebird;
