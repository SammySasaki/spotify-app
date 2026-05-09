import { useEffect } from 'react';

const Toast = ({ message, onDone, onUndo }) => {
    useEffect(() => {
        if (onUndo) return;
        const timer = setTimeout(onDone, 2500);
        return () => clearTimeout(timer);
    }, [onDone, onUndo]);

    return (
        <div className="toast">
            <span>{message}</span>
            <div className="toast-actions">
                {onUndo && <button className="toast-undo" onClick={onUndo}>Undo</button>}
                <button className="toast-dismiss" onClick={onDone}>✕</button>
            </div>
        </div>
    );
};

export default Toast;
