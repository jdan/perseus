/** @jsx React.DOM */
(function(Perseus) {

/* Collection of classes for rendering the hint editor area, 
 * hint editor boxes, and hint previews
 */

var Renderer = Perseus.Renderer;
var Editor = Perseus.Editor;

/* Renders just a hint preview */
var HintRenderer = Perseus.HintRenderer = React.createClass({
    render: function() {
        var shouldBold = this.props.bold;
        var hint = this.props.hint;
        var classNames;
        if (shouldBold) {
            classNames = "perseus-hint-renderer last-hint";
        } else {
            classNames = "perseus-hint-renderer";
        }
        return <div className={classNames}>
            {Renderer(hint)}
        </div>;
    }
});

/* Renders a hint editor box
 *
 * This includes:
 *  ~ the textarea for the hint
 *  ~ the "remove this hint" box
 *  ~ the move hint up/down arrows
 */
var HintEditor = Perseus.HintEditor = React.createClass({
    getDefaultProps: function() {
        return {
            content: ""
        };
    },

    render: function() {
        return <div className="perseus-hint-editor perseus-editor-left-cell">
            <Editor ref="editor" content={this.props.content}
                    onChange={this.props.onChange} widgetEnabled={false} />

            <div className="hint-controls-container clearfix">
                <span className="reorder-hints">
                    <a href="#"
                        className={this.props.isLast && "hidden"}
                        onClick={function() {
                            this.props.onMove(1);
                            return false;
                        }.bind(this)}>
                        <span className="icon-circle-arrow-down" />
                    </a>
                    {' '}
                    <a href="#"
                        className={this.props.isFirst && "hidden"}
                        onClick={function() {
                            this.props.onMove(-1);
                            return false;
                        }.bind(this)}>
                        <span className="icon-circle-arrow-up" />
                    </a>
                </span>
                <a href="#" className="remove-hint simple-button orange"
                        onClick={function() {
                            this.props.onRemove();
                            return false;
                        }.bind(this)}>
                    <span className="icon-trash" /> Remove this hint
                </a>
            </div>
        </div>;
    },

    focus: function() {
        this.refs.editor.focus();
    },

    toJSON: function(skipValidation) {
        return this.refs.editor.toJSON(skipValidation);
    }
});


/* A single hint-row containing a hint editor and preview */
var CombinedHintEditor = React.createClass({
    render: function() {
        var shouldBold = this.props.isLast &&
                         !(/\*\*/).test(this.props.hint.content);
        return <div className={"perseus-combined-hint-editor " +
                    "perseus-editor-row"}>
            <HintEditor
                ref="editor"
                isFirst={this.props.isFirst}
                isLast={this.props.isLast}
                content={this.props.hint.content}
                onChange={this.props.onChange}
                onRemove={this.props.onRemove}
                onMove={this.props.onMove} />

            <div className="perseus-editor-right-cell">
                <HintRenderer hint={this.props.hint} bold={shouldBold} />
            </div>
        </div>;
    },

    toJSON: function(skipValidation) {
        return this.refs.editor.toJSON(skipValidation);
    },

    focus: function() {
        this.refs.editor.focus();
    }
});


/* A cell in the hints table with content appearing in the left column
 * 
 * Simplifies having to set up the table rows and cells manually
 * Used for the "Hints:" prompt and "Add a hint" button
 */
var LeftColumnHintsTableCell = React.createClass({
    getDefaultProps: function() {
        return {
            className: ""
        };
    },

    render: function() {
        return <div className="perseus-editor-row">
            <div className={this.props.className +
                    " perseus-editor-left-cell"}>
                {this.props.children}
            </div>
            <div className="perseus-editor-right-cell" />
        </div>;
    }
});


/* The entire hints editing/preview area
 *
 * Includes:
 *  ~ The "Hints:" prompt
 *  ~ All the hint edit boxes, move and remove buttons
 *  ~ All the hint previews
 *  ~ The "add a hint" button
 */
var CombinedHintsEditor = Perseus.CombinedHintsEditor = React.createClass({
    defaultState: {
        hints: []
    },

    getInitialState: function() {
        var props = _.pick(this.props, _.keys(this.defaultState));
        return _.defaults(props, this.defaultState);
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState(_.pick(nextProps, _.keys(this.defaultState)));
    },
    
    render: function() {
        var hints = this.state.hints;
        var _this = this;
        var hintElems = _.map(hints, function(hint, i) {
            return <CombinedHintEditor
                        ref={"hintEditor" + i}
                        key={"hintEditor" + i}
                        isFirst={i === 0}
                        isLast={i + 1 === hints.length}
                        hint={hint}
                        onChange={this.handleHintChange.bind(this, i)}
                        onRemove={this.handleHintRemove.bind(this, i)}
                        onMove={this.handleHintMove.bind(this, i)} />;
        }, this);
        
        return <div className="perseus-hints-container perseus-editor-table">
            <LeftColumnHintsTableCell className="perseus-hints-title">
                Hints:
            </LeftColumnHintsTableCell>

            {hintElems}
            
            <LeftColumnHintsTableCell className="add-hint-container">
                <a href="#" className="simple-button orange"
                        onClick={this.addHint}>
                    <span className="icon-plus" />
                    Add a hint
                </a>
            </LeftColumnHintsTableCell>
        </div>;
    },

    handleHintChange: function(i, newProps, cb) {
        var hints = _.clone(this.state.hints);
        hints[i] = _.extend({}, this.state.hints[i], newProps);
        this.setState({hints: hints}, cb);
    },

    handleHintRemove: function(i) {
        var hints = _.clone(this.state.hints);
        hints.splice(i, 1);
        this.setState({hints: hints});
    },

    handleHintMove: function(i, dir) {
        var hints = _.clone(this.state.hints);
        var hint = hints.splice(i, 1)[0];
        hints.splice(i + dir, 0, hint);
        this.setState({hints: hints}, function() {
            this.refs["hintEditor" + (i + dir)].focus();
        });
    },
   
    addHint: function() {
        var hints = this.state.hints.concat([{}]);
        var i = hints.length - 1;

        this.setState({hints: hints}, function() {
            this.refs["hintEditor" + i].focus();
        }.bind(this));
        return false;
    },

    toJSON: function(skipValidation) {
        return this.state.hints.map(function(hint, i) {
            return this.refs["hintEditor" + i].toJSON(skipValidation);
        }, this);
    }
});

})(Perseus);
