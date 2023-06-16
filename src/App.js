import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import rough from "roughjs/bundled/rough.esm";
import getStroke from "perfect-freehand";

const generator = rough.generator();

const createElement = (id, x1, y1, x2, y2, type) => {
  switch (type) {
    case "line":
    case "rectangle":
      const roughElement =
        type === "line"
          ? generator.line(x1, y1, x2, y2)
          : generator.rectangle(x1, y1, x2 - x1, y2 - y1);
      return { id, x1, y1, x2, y2, type, roughElement };
    case "pencil":
      return { id, type, points: [{ x: x1, y: y1 }] };
    case "text":
      return { id, type, x1, y1, x2, y2, text: "" };
    case "not_gate":
      return { id, type, x1, y1 };
    case "and_gate":
      return { id, type, x1, y1 };
    case "or_gate":
      return { id, type, x1, y1 };  
    default:
      throw new Error(`Type not recognised: ${type}`);
  }
};

const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? "inside" : null;
};

const positionWithinElement = (x, y, element) => {
  const { type, x1, x2, y1, y2 } = element;
  switch (type) {
    case "line":
      const on = onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      return start || end || on;
    case "rectangle":
      const topLeft = nearPoint(x, y, x1, y1, "tl");
      const topRight = nearPoint(x, y, x2, y1, "tr");
      const bottomLeft = nearPoint(x, y, x1, y2, "bl");
      const bottomRight = nearPoint(x, y, x2, y2, "br");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topLeft || topRight || bottomLeft || bottomRight || inside;
    case "pencil":
      const betweenAnyPoint = element.points.some((point, index) => {
        const nextPoint = element.points[index + 1];
        if (!nextPoint) return false;
        return onLine(point.x, point.y, nextPoint.x, nextPoint.y, x, y, 5) != null;
      });
      return betweenAnyPoint ? "inside" : null;
    case "text":
      return x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
    case "not_gate":
      const topLeftNotGate = nearPoint(x, y, x1, y1 - 50, "tl");
      const topRightNotGate = nearPoint(x, y, x1 + 190, y1 - 50, "tr");
      const bottomLeftNotGate = nearPoint(x, y, x1, y1+ + 50, "bl");
      const bottomRightNotGate = nearPoint(x, y, x1 + 190, y1 + 50, "br");
      const insideNotGate = x >= x1 && x <= x1 + 190 && y >= y1 - 50 && y <= y1 + 50 ? "inside" : null;
      return topLeftNotGate || topRightNotGate || bottomLeftNotGate || bottomRightNotGate || insideNotGate;
    case "and_gate":
      const topLeftAndGate = nearPoint(x, y, x1, y1 - 20, "tl");
      const topRightAndGate = nearPoint(x, y, x1 + 190, y1 - 20, "tr");
      const bottomLeftAndGate = nearPoint(x, y, x1, y1 + 80, "bl");
      const bottomRightAndGate = nearPoint(x, y, x1 + 190, y1 + 80, "br");
      const insideAndGate = x >= x1 && x <= x1 + 190 && y >= y1 -20 && y <= y1 + 80 ? "inside" : null;
      return topLeftAndGate || topRightAndGate || bottomLeftAndGate || bottomRightAndGate || insideAndGate;
    case "or_gate":
      const topLeftOrGate = nearPoint(x, y, x1, y1 - 40, "tl");
      const topRightOrGate = nearPoint(x, y, x1 + 240, y1 - 40, "tr");
      const bottomLeftOrGate = nearPoint(x, y, x1, y1 + 100, "bl");
      const bottomRightOrGate = nearPoint(x, y, x1+ 240, y1 + 100, "br");
      const insideOrGate = x >= x1 && x <= x1 + 240 && y >= y1 - 40 && y <= y1 + 100 ? "inside" : null;
      return topLeftOrGate || topRightOrGate || bottomLeftOrGate || bottomRightOrGate || insideOrGate;
    default:
      throw new Error(`Type not recognised: ${type}`);
  }
};

const distance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const getElementAtPosition = (x, y, elements) => {
  return elements
    .map(element => ({ ...element, position: positionWithinElement(x, y, element) }))
    .find(element => element.position !== null);
};

const adjustElementCoordinates = element => {
  const { type, x1, y1, x2, y2 } = element;
  if (type === "rectangle") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2 };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
};

const cursorForPosition = position => {
  switch (position) {
    case "tl":
    case "br":
    case "start":
    case "end":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    default:
      return "move";
  }
};

const resizedCoordinates = (clientX, clientY, position, coordinates) => {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case "tl":
    case "start":
      return { x1: clientX, y1: clientY, x2, y2 };
    case "tr":
      return { x1, y1: clientY, x2: clientX, y2 };
    case "bl":
      return { x1: clientX, y1, x2, y2: clientY };
    case "br":
    case "end":
      return { x1, y1, x2: clientX, y2: clientY };
    default:
      return null; //should not really get here...
  }
};

const useHistory = initialState => {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([initialState]);

  const setState = (action, overwrite = false) => {
    const newState = typeof action === "function" ? action(history[index]) : action;
    if (overwrite) {
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    } else {
      const updatedState = [...history].slice(0, index + 1);
      setHistory([...updatedState, newState]);
      setIndex(prevState => prevState + 1);
    }
  };

  const undo = () => index > 0 && setIndex(prevState => prevState - 1);
  const redo = () => index < history.length - 1 && setIndex(prevState => prevState + 1);

  return [history[index], setState, undo, redo];
};

const getSvgPathFromStroke = stroke => {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
};

const drawElement = (roughCanvas, context, element) => {
  switch (element.type) {
    case "line":
    case "rectangle":
      roughCanvas.draw(element.roughElement);
      break;
    case "pencil":
      const stroke = getSvgPathFromStroke(getStroke(element.points, {
        size: 5,
      }));
      context.fill(new Path2D(stroke));
      break;
    case "text":
      context.textBaseline = "top";
      context.font = "24px sans-serif";
      context.fillText(element.text, element.x1, element.y1);
      break;
    case "not_gate" :
      context.beginPath();
      context.moveTo(element.x1, element.y1);
      context.lineTo(element.x1 + 70, element.y1);
      context.moveTo(element.x1 + 70, element.y1 - 50);
      context.lineTo(element.x1 + 70, element.y1 + 50);
      context.lineTo(element.x1 + 120, element.y1);
      context.lineTo(element.x1 + 70, element.y1 - 50);
      context.moveTo(element.x1 + 130, element.y1);
      context.arc(element.x1 + 125, element.y1, 5, 0,  Math.PI * 2, true)
      context.lineTo(element.x1 + 190, element.y1);
      context.closePath();
      context.stroke();
      break;
    case "and_gate" :
      context.beginPath();
      context.moveTo(element.x1, element.y1);
      context.lineTo(element.x1 + 70, element.y1);
      context.moveTo(element.x1, element.y1 + 60);
      context.lineTo(element.x1 + 70, element.y1 + 60);
      context.moveTo(element.x1 + 70, element.y1 -20);
      context.lineTo(element.x1 + 70, element.y1 + 80);
      context.arc(element.x1 + 70, element.y1 + 30, 50, Math.PI*3/2, Math.PI/2, false);
      context.moveTo(element.x1 + 120, element.y1 + 30);
      context.lineTo(element.x1 + 190, element.y1 + 30);
      context.closePath();
      context.stroke();
      break;
      case "or_gate" :
        context.beginPath();
        context.moveTo(element.x1, element.y1);
        context.lineTo(element.x1 + 85, element.y1);
        context.moveTo(element.x1, element.y1 + 60);
        context.lineTo(element.x1 + 85, element.y1 + 60);
        context.moveTo(element.x1 + 50, element.y1-40);
        context.ellipse(element.x1 + 50, element.y1 + 30, 40, 70, 0, -Math.PI/2, Math.PI/2);
        context.moveTo(element.x1 + 50, element.y1-40);
        context.quadraticCurveTo(element.x1 + 105, element.y1-50, element.x1 + 160, element.y1+30);
        context.moveTo(element.x1 + 50, element.y1+ 100);
        context.quadraticCurveTo(element.x1 + 105, element.y1+ 110, element.x1 + 160, element.y1+30);
        context.moveTo(element.x1 + 160, element.y1+30);
        context.lineTo(element.x1 + 240, element.y1 + 30);
        context.closePath();
        context.stroke();
        break;
    default:
      throw new Error(`Type not recognised: ${element.type}`);
  }
};

const adjustmentRequired = type => ["line", "rectangle"].includes(type);

const App = () => {
  const [elements, setElements, undo, redo] = useHistory([]);
  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("text");
  const [selectedElement, setSelectedElement] = useState(null);
  const textAreaRef = useRef();

  useLayoutEffect(() => {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    const roughCanvas = rough.canvas(canvas);

    elements.forEach(element => {
      if (action === "writing" && selectedElement.id === element.id) return;
      drawElement(roughCanvas, context, element);
    });
  }, [elements, action, selectedElement]);

  useEffect(() => {
    const undoRedoFunction = event => { 

      if ((event.metaKey || event.ctrlKey) && event.key === "z") { 
        undo(); 
       } 
        
       else if ((event.metaKey || event.ctrlKey) && event.key === "y") { 
        redo(); 
       } 
    };

    document.addEventListener("keydown", undoRedoFunction);
    return () => {
      document.removeEventListener("keydown", undoRedoFunction);
    };
  }, [undo, redo]);


  useEffect(() => {
    const textArea = textAreaRef.current;
    if (action === "writing") {
      //textArea.focus();
      textArea.value = selectedElement.text;
    }
  }, [action, selectedElement]);

  const updateElement = (id, x1, y1, x2, y2, type, options) => {
    const elementsCopy = [...elements];

    switch (type) {
      case "line":
      case "rectangle":
        elementsCopy[id] = createElement(id, x1, y1, x2, y2, type);
        break;
      case "pencil":
        elementsCopy[id].points = [...elementsCopy[id].points, { x: x2, y: y2 }];
        break;
      case "text":
        const textWidth = document
          .getElementById("canvas")
          .getContext("2d")
          .measureText(options.text).width;
        const textHeight = 24;
        elementsCopy[id] = {
          ...createElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type),
          text: options.text,
        };
        break;
        case "not_gate":
          elementsCopy[id] = createElement(id, x1, y1, 0, 0, type);
          break;
        case "and_gate":
          elementsCopy[id] = createElement(id, x1, y1, 0, 0, type);
          break;
        case "or_gate":
          elementsCopy[id] = createElement(id, x1, y1, 0, 0, type);
          break;
      default:
        //throw new Error(`Type not recognised: ${type}`);
    }

    setElements(elementsCopy, true);
  };

  const handleMouseDown = event => {
    if (action === "writing") return;

    const { clientX, clientY } = event;
    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      if (element) {
        if (element.type === "pencil") {
          const xOffsets = element.points.map(point => clientX - point.x);
          const yOffsets = element.points.map(point => clientY - point.y);
          setSelectedElement({ ...element, xOffsets, yOffsets });
        } else {
          const offsetX = clientX - element.x1;
          const offsetY = clientY - element.y1;
          setSelectedElement({ ...element, offsetX, offsetY });
        }
        setElements(prevState => prevState);

        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resizing");
        }
      }
    } else {
      const id = elements.length;
      const element = createElement(id, clientX, clientY, clientX, clientY, tool);
      setElements(prevState => [...prevState, element]);
      setSelectedElement(element);

      setAction(tool === "text" ? "writing" : "drawing");
    }
  };

  const handleMouseMove = event => {
    const { clientX, clientY } = event;

    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      event.target.style.cursor = element ? cursorForPosition(element.position) : "default";
    }

    if (action === "drawing") {
      const index = elements.length - 1;
      const { x1, y1 } = elements[index];
      updateElement(index, x1, y1, clientX, clientY, tool);
    } else if (action === "moving") {
      if (selectedElement.type === "pencil") {
        const newPoints = selectedElement.points.map((_, index) => ({
          x: clientX - selectedElement.xOffsets[index],
          y: clientY - selectedElement.yOffsets[index],
        }));
        const elementsCopy = [...elements];
        elementsCopy[selectedElement.id] = {
          ...elementsCopy[selectedElement.id],
          points: newPoints,
        };
        setElements(elementsCopy, true);
      } else {
        const { id, x1, x2, y1, y2, type, offsetX, offsetY } = selectedElement;
        const width = x2 - x1;
        const height = y2 - y1;
        const newX1 = clientX - offsetX;
        const newY1 = clientY - offsetY;
        const options = type === "text" ? { text: selectedElement.text } : {};
        updateElement(id, newX1, newY1, newX1 + width, newY1 + height, type, options);
      }
    } else if (action === "resizing") {
        const { id, type, position, ...coordinates } = selectedElement;
        if(selectedElement.type === "not_gate" || "and_gate" || "or_gate"){

        }else{
        const { x1, y1, x2, y2 } = resizedCoordinates(clientX, clientY, position, coordinates);
        updateElement(id, x1, y1, x2, y2, type);
        }
    }
  };

  const handleMouseUp = event => {
    const { clientX, clientY } = event;
    if (selectedElement) {
      if (
        selectedElement.type === "text" &&
        clientX - selectedElement.offsetX === selectedElement.x1 &&
        clientY - selectedElement.offsetY === selectedElement.y1
      ) {
        setAction("writing");
        return;
      }

      const index = selectedElement.id;
      const { id, type } = elements[index];
      if ((action === "drawing" || action === "resizing") && adjustmentRequired(type)) {
        const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
        updateElement(id, x1, y1, x2, y2, type);
      }
    }

    if (action === "writing") return;

    setAction("none");
    setSelectedElement(null);
  };

  const handleBlur = event => {
    const { id, x1, y1, type } = selectedElement;
    setAction("none");
    setSelectedElement(null);
    updateElement(id, x1, y1, null, null, type, { text: event.target.value });
  };

  const clrCanvas = () => {
    const clr = [];
    setElements(clr);
  };

  return (
    <div>
      <div style={{ position: "fixed" }}>
        <input
          type="radio"
          id="selection"
          checked={tool === "selection"}
          onChange={() => setTool("selection")}
        />
        <label htmlFor="selection">Selection</label>
        <input type="radio" id="line" checked={tool === "line"} onChange={() => setTool("line")} />
        <label htmlFor="line">Line</label>
        <input
          type="radio"
          id="rectangle"
          checked={tool === "rectangle"}
          onChange={() => setTool("rectangle")}
        />
        <label htmlFor="rectangle">Rectangle</label>
        <input
          type="radio"
          id="pencil"
          checked={tool === "pencil"}
          onChange={() => setTool("pencil")}
        />
        <label htmlFor="pencil">Pencil</label>
        <input 
           type="radio" 
           id="text" 
           checked={tool === "text"} 
           onChange={() => setTool("text")}
        />
        <label htmlFor="text">Text  </label>
        <input
          type="radio"
          id="not_gate"
          checked={tool === "not_gate"}
          onChange={() => setTool("not_gate")}
        />
        <label htmlFor="not_gate">Not Gate  </label>
        <input
          type="radio"
          id="and_gate"
          checked={tool === "and_gate"}
          onChange={() => setTool("and_gate")}
        />
        <label htmlFor="or_gate">And Gate  </label>
        <input
          type="radio"
          id="or_gate"
          checked={tool === "or_gate"}
          onChange={() => setTool("or_gate")}
        />
        <label htmlFor="or_gate">Or Gate  </label>
        <input
          type="button"
          id="clr"
          value="Clear"
          onClick={() => clrCanvas()}
        />
      </div>
      <div style={{ position: "fixed", bottom: 0, padding: 10 }}>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
      </div>
      {action === "writing" ? (
        <textarea
          ref={textAreaRef}
          onBlur={handleBlur}
          style={{
            position: "fixed",
            top: selectedElement.y1 - 2,
            left: selectedElement.x1,
            font: "24px sans-serif",
            margin: 0,
            padding: 0,
            border: 0,
            outline: 0,
            resize: "auto",
            overflow: "hidden",
            whiteSpace: "pre",
            background: "transparent",
          }}
        />
      ) : null}
      <canvas
        id="canvas"
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        Canvas
      </canvas>
    </div>
  );
};

export default App;