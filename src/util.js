(function(Perseus) {

var Util = Perseus.Util = {
    rWidgetParts: /^\[\[\u2603 (([a-z-]+) ([0-9]+))\]\]$/,

    seededRNG: function(seed) {
        var randomSeed = seed;

        return function() {
            // Robert Jenkins' 32 bit integer hash function.
            var seed = randomSeed;
            seed = ((seed + 0x7ed55d16) + (seed << 12)) & 0xffffffff;
            seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffffffff;
            seed = ((seed + 0x165667b1) + (seed << 5)) & 0xffffffff;
            seed = ((seed + 0xd3a2646c) ^ (seed << 9)) & 0xffffffff;
            seed = ((seed + 0xfd7046c5) + (seed << 3)) & 0xffffffff;
            seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffffffff;
            return (randomSeed = (seed & 0xfffffff)) / 0x10000000;
        };
    },

    shuffle: function(array, seed) {
        var random = Util.seededRNG(seed);

        // Fischer-Yates shuffle
        array = array.slice();

        for (var top = array.length; top > 0; top--) {
            var newEnd = Math.floor(random() * top),
                tmp = array[newEnd];

            array[newEnd] = array[top - 1];
            array[top - 1] = tmp;
        }

        return array;
    },

    // In IE8, split doesn't work right. Implement it ourselves.
    split: "x".split(/(.)/g).length ?
        function(str, r) { return str.split(r); } :
        function(str, r) {
            // Based on Steven Levithan's MIT-licensed split, available at
            // http://blog.stevenlevithan.com/archives/cross-browser-split
            var output = [];
            var lastIndex = r.lastIndex = 0;
            var match;

            while ((match = r.exec(str))) {
                output.push(str.slice(lastIndex, match.index));
                output.push.apply(output, match.slice(1));
                lastIndex = match.index + match[0].length;
            }

            output.push(str.slice(lastIndex));
            return output;
        },

    /**
     * Given two score objects for two different widgets, combine them so that
     * if one is wrong, the total score is wrong, etc.
     */
    combineScores: function(scoreA, scoreB) {
        var message;

        if (scoreA.type === "points" && scoreB.type === "points") {
            if (scoreA.message && scoreB.message &&
                    scoreA.message !== scoreB.message) {
                // TODO(alpert): Figure out how to combine messages usefully
                message = null;
            } else {
                message = scoreA.message || scoreB.message;
            }

            return {
                type: "points",
                earned: scoreA.earned + scoreB.earned,
                total: scoreA.total + scoreB.total,
                message: message
            };

        } else if (scoreA.type === "points" && scoreB.type === "invalid") {
            return scoreB;

        } else if (scoreA.type === "invalid" && scoreB.type === "points") {
            return scoreA;

        } else if (scoreA.type === "invalid" && scoreB.type === "invalid") {
            if (scoreA.message && scoreB.message &&
                    scoreA.message !== scoreB.message) {
                // TODO(alpert): Figure out how to combine messages usefully
                message = null;
            } else {
                message = scoreA.message || scoreB.message;
            }

            return {
                type: "invalid",
                message: message
            };
        }
    },

    /**
     * Return the first valid interpretation of 'text' as a number, in the form
     * {value: 2.3, exact: true}.
     */
    firstNumericalParse: function(text) {
        // TODO(alpert): This is sort of hacky...
        var first;
        var val = Khan.answerTypes.predicate.createValidatorFunctional(
            function(ans) {
                first = ans;
                return true;  /* break */
            }, {
                simplify: "optional",
                inexact: true,
                forms: "integer, proper, improper, pi, log, mixed, decimal"
            });

        val(text);
        return first;
    },

    stringArrayOfSize: function(size) {
        return _(size).times(function() {
            return "";
        });
    },

    /**
     * For a graph's x or y dimension, given the tick step,
     * the ranges extent (e.g. [-10, 10]), and
     * pixel dimension constraint, return a bunch of configurations for
     * that dimension.
     *
     * Example:
     *      gridDimensionConfig(10, [-50, 50], 400)
     *
     * Returns: {
     *      scale: 4,
     *      gridStep: 5,
     *      snap: 2.5,
     *      tickStep: 2,
     *      unityLabel: true
     * };
     */
     gridDimensionConfig: function(absTickStep, extent, dimensionConstraint) {
        var scale = Perseus.Util.scaleFromExtent(extent, dimensionConstraint);
        var gridStep = Perseus.Util.gridStepFromTickStep(absTickStep, scale);
        var stepPx = absTickStep * scale;
        var unityLabel = stepPx > 30;
        return {
            scale: scale,
            gridStep: gridStep,
            snap: gridStep / 2,
            tickStep: absTickStep / gridStep,
            unityLabel: unityLabel
        };
    },

    /**
     * Given the range and a dimension, come up with the appropriate
     * scale.
     * Example:
     *      scaleFromExtent([-25, 25], 500) // returns 10
     */
    scaleFromExtent: function(extent, dimensionConstraint) {
        var span = extent[1] - extent[0];
        var scale = dimensionConstraint / span;
        if (scale > 5) {
            scale = Math.floor(scale);
        }
        return scale;
    },

    /**
     * Return a reasonable tick step given extent and dimension.
     * (extent is [begin, end] of the domain.)
     * Example:
     *      tickStepFromExtent([-10, 10], 300) // returns 2
     */
    tickStepFromExtent: function(extent, dimensionConstraint) {
        var span = extent[1] - extent[0];

        var tickFactor;
        // If single number digits
        if (15 < span && span <= 20) {
            tickFactor = 23;

        // triple digit or decimal
        } else if (span > 100 || span < 5) {
            tickFactor = 10;

        // double digit
        } else {
            tickFactor = 16;
        }
        var constraintFactor = dimensionConstraint / 500;
        var desiredNumTicks = tickFactor * constraintFactor;
        return Perseus.Util.tickStepFromNumTicks(span, desiredNumTicks);
    },

    /**
     * Given the tickStep and the graph's scale, find a
     * grid step.
     * Example:
     *      gridStepFromTickStep(200, 0.2) // returns 100
     */
    gridStepFromTickStep: function(tickStep, scale) {
        var tickWidth = tickStep * scale;
        var x = tickStep;
        var y = Math.pow(10, Math.floor(Math.log(x) / Math.LN10));
        var leadingDigit = Math.floor(x / y);
        if (tickWidth < 25) {
            return tickStep;
        }
        if (tickWidth < 50) {
            if (leadingDigit === 5) {
                return tickStep;
            } else {
                return tickStep / 2;
            }
        }
        if (leadingDigit === 1) {
            return tickStep / 2;
        }
        if (leadingDigit === 2) {
            return tickStep / 4;
        }
        if (leadingDigit === 5) {
            return tickStep / 5;
        }
    },

    /**
     * Find a good tick step for the desired number of ticks in the range
     * Modified from d3.scale.linear: d3_scale_linearTickRange.
     * Thanks, mbostock!
     * Example:
     *      tickStepFromNumTicks(50, 6) // returns 10
     */
    tickStepFromNumTicks: function(span, numTicks) {
        var step = Math.pow(10, Math.floor(Math.log(span / numTicks) / Math.LN10));
        var err = numTicks / span * step;

        // Filter ticks to get closer to the desired count.
        if (err <= 0.15) {
            step *= 10;
        } else if (err <= 0.35) {
            step *= 5;
        } else if (err <= 0.75) {
            step *= 2;
        }

        // Round start and stop values to step interval.
        return step;
    },

    /**
     * Transparently update deprecated props so that the code to deal
     * with them only lives in one place: (Widget).deprecatedProps
     * 
     * For example, if a boolean `foo` was deprecated in favor of a
     * number 'bar':
     *      deprecatedProps: {
     *          foo: function(props) {
     *              return {bar: props.foo ? 1 : 0};
     *          }
     *      }
     */
    DeprecationMixin: {
        // This lifecycle stage is only called before first render
        componentWillMount: function() {
            var newProps = {};

            _.each(this.deprecatedProps, function(func, prop) {
                if (_.has(this.props, prop)) {
                    _.extend(newProps, func(this.props));
                }
            }, this);

            if (!_.isEmpty(newProps)) {
                // Set new props directly so that widget renders correctly
                // when it first mounts, even though these will be overwritten
                // almost immediately afterwards...
                _.extend(this.props, newProps);

                // ...when we propagate the new props upwards and they come
                // back down again.
                setTimeout(this.props.onChange, 0, newProps);    
            }
        },
    },

    /**
     * Approximate equality on numbers and primitives.
     */
    eq: function(x, y) {
        if (_.isNumber(x) && _.isNumber(y)) {
            return Math.abs(x - y) < 1e-9;
        } else {
            return x === y;
        }
    }, 

    /**
     * Deep approximate equality on primitives, numbers, arrays, and objects.
     */
    deepEq: function(x, y) {
        if (_.isArray(x) && _.isArray(y)) {
            if (x.length !== y.length) {
                return false;
            }
            for (var i = 0; i < x.length; i++) {
                if (!Perseus.Util.deepEq(x[i], y[i])) {
                    return false;
                }
            }
            return true;
        } else if (_.isArray(x) || _.isArray(y)) {
            return false;
        } else if (_.isObject(x) && _.isObject(y)) {
            return _.all(x, function(value, key) {
                return Perseus.Util.deepEq(y[key], value);
            }) && _.all(y, function(value, key) {
                return Perseus.Util.deepEq(x[key], value);
            });
        } else if (_.isObject(x) || _.isObject(y)) {
            return false;
        } else {
            return Perseus.Util.eq(x, y);
        }
    }
};

Util.random = Util.seededRNG(new Date().getTime() & 0xffffffff);

})(Perseus);
