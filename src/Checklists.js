var request = require('request-promise');
var cheerio = require('cheerio');
var csvString = require('csv-string');

var parseResults = (html) => {
    var $ = cheerio.load(html);
    var trs = $('div#content table tbody tr');
    var results = [];
    trs.each((i, elem) => {

        var tr = $(elem);
        var url = tr.find('td.c a')
            .attr('onclick')
            .replace('location.href=\'/ebird/view/checklist/', '')
            .replace('\'', '')
        ;

        results.push('http://ebird.org/ebird/view/checklist/download?subID='+url);
    });

    return results;
};

var parseCsvResults = csv => {

    var checklist = csvString.parse(csv);

    return checklist;
};

module.exports = {
    shared: function() {
        return request({
            uri: 'http://ebird.org/ebird/shared',
            headers: {
                'Cookie': `EBIRD_SESSIONID=${this.session}`
            }
        }).then(parseResults);
    },
    csv: function(url) {
        return request({
            uri: url,
            headers: {
                'Cookie': `EBIRD_SESSIONID=${this.session}`
            }
        }).then(parseCsvResults);
    }
};
