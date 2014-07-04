function round(x) {
    return x.toFixed(3);
}

Converter = {
    types: ['eu', 'us', 'uk', 'hk'],

    eu_to_eu: function (x) {
        return x;
    },
    uk_to_uk: function (x) {
        return x;
    },
    us_to_us: function (x) {
        return x;
    },
    hk_to_hk: function (x) {
        return x;
    },

    eu_to_us: function (x) {
        var v = (x >= 2.0) ? (100.0 * (x - 1.0)) : (-100.0 / (x - 1.0));
        return (v >= 0 ? "+" : "") + v.toFixed(0);
    },

    eu_to_uk: function (x) {
        var fr = (new Fraction(x - 1)).normalize();
        return fr.numerator + "/" + fr.denominator;
    },

    eu_to_hk: function (x) {
        return round(x - 1.0);
    },

    us_to_eu: function (x) {
        var v = (x >= 0.0) ? (x / 100.0 + 1) : (-100.0 / x + 1.0);
        return round(v);
    },

    us_to_uk: function (x) {
        var fr = (x >= 0) ? new Fraction(x, 100) : new Fraction(100, -x);
        fr = fr.normalize();
        return (x >= 0 ? "+" : "-") + fr.numerator + "/" + fr.denominator;
    },
    us_to_hk: function (x) {
        return Converter.eu_to_hk(Converter.us_to_eu(x));
    },

    uk_to_eu: function (x) {
        var fr = x.split("/");
        return fr[0] / fr[1] + 1.0;
    },

    uk_to_us: function (x) {
        return Converter.eu_to_us(Converter.uk_to_eu(x));
    },

    uk_to_hk: function (x) {
        return Converter.eu_to_hk(Converter.uk_to_eu(x));
    },

    hk_to_eu: function (x) {
        return round(parseFloat(x) + 1.0);
    },

    hk_to_us: function (x) {
        return Converter.eu_to_us(Converter.hk_to_eu(x));
    },

    hk_to_uk: function (x) {
        return Converter.eu_to_uk(Converter.hk_to_eu(x));
    },
};

$("input.k").bind('change', function (e) {
    var el = e.currentTarget;
    var k = $(el).val();
    var current_type = el.className.match(/(eu|us|uk|hk)/)[0];
    var curr_d = el.className.match(/(back|lay)/)[0];

    var inv_d = curr_d === "back" ? "lay" : "back";
    var to_us = Converter[current_type + "_to_us"];

    var inv = -1 * parseFloat(to_us(k));

    _(_(Converter.types).without(current_type)).each(function (type) {
        var fn = Converter[current_type + "_to_" + type];
        var inv_fn = Converter["us_to_" + type];
        $(".k." + curr_d + "." + type).val(fn(k));
        $(".k." + inv_d + "." + type).val(inv_fn(inv));
    });
    var inv_fn = Converter["us_to_" + current_type];
    $(".k." + inv_d + "." + current_type).val(inv_fn(inv));

    return false;
});

