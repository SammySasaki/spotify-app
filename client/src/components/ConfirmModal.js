const ConfirmModal = ({ message, onConfirm, onCancel }) => (
    <div className="modal-overlay" onClick={onCancel}>
        <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Are you sure?</h2>
            <p>{message}</p>
            <div className="modal-actions">
                <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="btn-action" onClick={onConfirm}>Confirm</button>
            </div>
        </div>
    </div>
);

export default ConfirmModal;
