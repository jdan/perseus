/** @jsx React.DOM */
(function(Perseus) {

/**
 * For math rendered using MathJax. Use me like <TeX>2x + 3</TeX>.
 */
var TeX = Perseus.TeX = (function() {
    var pendingScripts = [];
    var needsProcess = false;
    var timeout = null;

    function process(script) {
        pendingScripts.push(script);
        if (!needsProcess) {
            needsProcess = true;
            timeout = setTimeout(doProcess, 0);
        }
    }

    function doProcess() {
        MathJax.Hub.Queue(function() {
            var oldElementScripts = MathJax.Hub.elementScripts;
            MathJax.Hub.elementScripts = function(element) {
                var scripts = pendingScripts;
                pendingScripts = [];
                needsProcess = false;
                return scripts;
            };

            try {
                return MathJax.Hub.Process();
            } catch (e) {
                // (IE8 needs this catch)
                throw e;
            } finally {
                MathJax.Hub.elementScripts = oldElementScripts;
            }
        });
    }

    return React.createClass({
        render: function() {
            return <span>
                <span ref="mathjax" />
                <span ref="katex" />
            </span>;
        },

        componentDidMount: function(span) {
            var text = this.props.children;

            if (typeof Exercises === "undefined" || Exercises.useKatex) {
                try {
                    var katexHolder = this.refs.katex.getDOMNode();
                    katex.process(text, katexHolder);
                    return;
                } catch (e) {
                    /* jshint -W103 */
                    if (e.__proto__ !== katex.ParseError.prototype) {
                    /* jshint +W103 */
                        throw e;
                    }
                }
            }

            this.setScriptText(text);
            process(this.script);
        },

        componentDidUpdate: function(prevProps, prevState, span) {
            var oldText = prevProps.children;
            var newText = this.props.children;

            if (oldText !== newText) {
                if (typeof Exercises === "undefined" || Exercises.useKatex) {
                    try {
                        var katexHolder = this.refs.katex.getDOMNode();
                        katex.process(newText, katexHolder);
                        if (this.script) {
                            var jax = MathJax.Hub.getJaxFor(this.script);
                            if (jax) {
                                jax.Remove();
                            }
                        }
                        return;
                    } catch (e) {
                        /* jshint -W103 */
                        if (e.__proto__ !== katex.ParseError.prototype) {
                        /* jshint +W103 */
                            throw e;
                        }
                    }
                }

                $(this.refs.katex.getDOMNode()).empty();

                if (this.script) {
                    var component = this;
                    MathJax.Hub.Queue(function() {
                        var jax = MathJax.Hub.getJaxFor(component.script);
                        if (jax) {
                            return jax.Text(newText);
                        } else {
                            component.setScriptText(newText);
                            process(component.script);
                        }
                    });
                } else {
                    this.setScriptText(newText);
                    process(this.script);
                }
            }
        },

        setScriptText: function(text) {
            if (!this.script) {
                this.script = document.createElement("script");
                this.script.type = "math/tex";
                this.refs.mathjax.getDOMNode().appendChild(this.script);
            }
            if ("text" in this.script) {
                // IE8, etc
                this.script.text = text;
            } else {
                this.script.textContent = text;
            }
        },

        componentWillUnmount: function() {
            if (this.script) {
                var jax = MathJax.Hub.getJaxFor(this.script);
                if (jax) {
                    jax.Remove();
                }
            }
        }
    });
})();


var Renderer = Perseus.Renderer = React.createClass({

    componentWillReceiveProps: function(nextProps) {
        if (!_.isEqual(this.props, nextProps)) {
            this.setState({widgets: {}});
        }
    },

    getDefaultProps: function() {
        return {
            content: "",
            ignoreMissingWidgets: false
        };
    },

    getInitialState: function() {
        // TODO(alpert): Move up to parent props?
        return {
            widgets: {}
        };
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        var stateChanged = !_.isEqual(this.state, nextState);
        var propsChanged = !_.isEqual(this.props, nextProps);
        return propsChanged || stateChanged;
    },

    getPiece: function(saved, widgetIds) {
        if (saved.charAt(0) === "@") {
            // Just text
            return saved;
        } else if (saved.charAt(0) === "$") {
            // Math
            var tex = saved.slice(1, saved.length - 1);
            return <TeX>{tex}</TeX>;
        } else if (saved.charAt(0) === "[") {
            // Widget
            var match = Perseus.Util.rWidgetParts.exec(saved);
            var id = match[1];
            var type = match[2];

            var widgetInfo = (this.props.widgets || {})[id];
            if (widgetInfo || this.props.ignoreMissingWidgets) {
                widgetIds.push(id);
                var cls = Perseus.Widgets._widgetTypes[type];

                return cls(_.extend({
                    ref: id,
                    onChange: function(newProps, cb) {
                        var widgets = _.clone(this.state.widgets);
                        widgets[id] = _.extend({}, widgets[id], newProps);
                        this.setState({widgets: widgets}, cb);
                    }.bind(this)
                }, (widgetInfo || {}).options, this.state.widgets[id]));
            }
        }
    },

    render: function() {
        var self = this;
        var extracted = extractMathAndWidgets(this.props.content);
        var markdown = extracted[0];
        var savedMath = extracted[1];
        var widgetIds = this.widgetIds = [];

        // XXX(alpert): smartypants gets called on each text node before it's
        // added to the DOM tree, so we override it to insert the math and
        // widgets.
        var smartypants = markedReact.InlineLexer.prototype.smartypants;
        markedReact.InlineLexer.prototype.smartypants = function(text) {
            var pieces = Perseus.Util.split(text, /@@(\d+)@@/g);
            for (var i = 0; i < pieces.length; i++) {
                var type = i % 2;
                if (type === 0) {
                    pieces[i] = smartypants.call(this, pieces[i]);
                } else if (type === 1) {
                    // A saved math-or-widget number
                    pieces[i] = self.getPiece(savedMath[pieces[i]], widgetIds);
                }
            }
            return pieces;
        };

        try {
            return <div>{markedReact(markdown)}</div>;
        } catch (e) {
            // (IE8 needs this catch)
            throw e;
        } finally {
            markedReact.InlineLexer.prototype.smartypants = smartypants;
        }
    },

    focus: function() {
        // Use _.some to break if any widget gets focused
        var focused = _.some(this.widgetIds, function(id) {
            var widget = this.refs[id];
            return widget.focus && widget.focus();
        }, this);

        if (focused) {
            return true;
        }
    },

    toJSON: function(skipValidation) {
        var state = {};
        _.each(this.props.widgets, function(props, id) {
            var widget = this.refs[id];
            var s = widget.toJSON(skipValidation);
            if (!_.isEmpty(s)) {
                state[id] = s;
            }
        }, this);
        return state;
    },

    guessAndScore: function() {
        var totalGuess = [];
        var totalScore = {
            type: "points",
            earned: 0,
            total: 0,
            message: null
        };

        var widgetProps = this.props.widgets;
        totalScore = _.chain(this.widgetIds)
                .map(function(id) {
                    var props = widgetProps[id];
                    var widget = this.refs[id];
                    var guess = widget.toJSON();
                    totalGuess.push(guess);
                    return widget.simpleValidate(props.options);
                }, this)
                .reduce(Perseus.Util.combineScores, totalScore)
                .value();

        return [totalGuess, totalScore];
    },

    examples: function() {
        var widgets = _.values(this.refs);
        var examples = _.compact(_.map(widgets, function(widget) {
            return widget.examples ? widget.examples() : null;
        }));

        // no widgets with examples
        if (!examples.length) {
            return null;
        }

        var allEqual = _.all(examples, function(example) {
            return _.isEqual(examples[0], example);
        });

        // some widgets have different examples
        // TODO(alex): handle this better
        if (!allEqual) {
            return null;
        }

        return examples[0];
    }
});

var rInteresting =
        /(\$|[{}]|\\[\\${}]|\n{2,}|\[\[\u2603 [a-z-]+ [0-9]+\]\]|@@\d+@@)/g;

function extractMathAndWidgets(text) {
    // "$x$ is a cool number, just like $6 * 7$!" gives
    //     ["@@0@@ is a cool number, just like @@1@@!", ["$x$", "$6 * 7$"]]
    //
    // Inspired by http://stackoverflow.com/q/11231030.
    var savedMath = [];
    var blocks = Perseus.Util.split(text, rInteresting);

    var mathPieces = [], l = blocks.length, block, braces;
    for (var i = 0; i < l; i++) {
        block = blocks[i];

        if (mathPieces.length) {
            // Looking for an end delimeter
            mathPieces.push(block);
            blocks[i] = "";

            if (block === "$" && braces <= 0) {
                blocks[i] = saveMath(mathPieces.join(""));
                mathPieces = [];
            } else if (block.slice(0, 2) === "\n\n" || i === l - 1) {
                // We're at the end of a line... just don't do anything
                // TODO(alpert): Error somehow?
                blocks[i] = mathPieces.join("");
                mathPieces = [];
            } else if (block === "{") {
                braces++;
            } else if (block === "}") {
                braces--;
            }
        } else if (i % 2 === 1) {
            // Looking for a start delimeter
            var two = block && block.slice(0, 2);
            if (two === "[[" || two === "@@") {
                // A widget or an @@n@@ thing (which we pull out so we don't
                // get confused later).
                blocks[i] = saveMath(block);
            } else if (block === "$") {
                // We got one! Save it for later and blank out its space.
                mathPieces.push(block);
                blocks[i] = "";
                braces = 0;
            }
            // Else, just normal text. Move along, move along.
        }
    }

    return [blocks.join(""), savedMath];

    function saveMath(math) {
        savedMath.push(math);
        return "@@" + (savedMath.length - 1) + "@@";
    }
}

Renderer.extractMathAndWidgets = extractMathAndWidgets;

})(Perseus);
