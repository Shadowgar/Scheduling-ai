"""
Excel Import Routes

Provides endpoints for uploading and processing Excel files for historical scheduling data import.
"""
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import os
import json
import io
import numpy as np
from utils.logging_utils import get_logger
import traceback
import os

excel_bp = Blueprint('excel', __name__, url_prefix='/api/excel')

logger = get_logger("excel_import")

UPLOAD_FOLDER = 'inputs/excel_uploads'
ALLOWED_EXTENSIONS = {'xls', 'xlsx'}

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """
    Check if the uploaded file has an allowed Excel extension.

    Args:
        filename (str): The name of the uploaded file.

    Returns:
        bool: True if allowed, False otherwise.
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

from models import db, PolicyDocument, ExcelSheet
from datetime import datetime, timezone
import pandas as pd

@excel_bp.route('/upload', methods=['POST'])
def upload_excel():
    """
    Handle Excel file upload and persist to PolicyDocument and ExcelSheet.

    Returns:
        JSON: Success or error message.
    """
    if 'file' not in request.files:
        logger.error("No file part in request for Excel upload")
        return jsonify({'error': 'No file part in request'}), 400
    file = request.files['file']
    if file.filename == '':
        logger.error("No selected file in Excel upload")
        return jsonify({'error': 'No selected file'}), 400
    if not allowed_file(file.filename):
        logger.error(f"Invalid file type attempted: {file.filename}")
        return jsonify({'error': 'Invalid file type'}), 400

    filename = secure_filename(file.filename)
    file_bytes = file.read()

    # Save file to disk as well as to DB
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    # Use timestamp to ensure unique filename
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    disk_filename = f"{timestamp}_{filename}"
    save_path = os.path.join(UPLOAD_FOLDER, disk_filename)
    with open(save_path, "wb") as f:
        f.write(file_bytes)

    try:
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        sheet_names = excel_file.sheet_names
    except Exception as e:
        logger.error(f"Failed to parse Excel file '{filename}': {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to parse Excel file: {str(e)}'}), 400

    # Save PolicyDocument
    new_doc = PolicyDocument(
        filename=filename,
        file_type='excel',
        uploaded_at=datetime.now(timezone.utc),
        uploader_id=None,  # Set to current_user.id if using auth
        content="[Excel file]",
        file_data=file_bytes,
        file_path=save_path,
        status="Pending",
        chunk_count=0,
        error_message=None
    )
    db.session.add(new_doc)
    db.session.flush()  # Get new_doc.id

    # For each sheet, create ExcelSheet entry with preview
    sheet_entries = []
    for sheet_name in sheet_names:
        try:
            preview_df = excel_file.parse(sheet_name).head(5)
            # Robustly replace NaN, inf, -inf with None for JSON compatibility
            preview_df = preview_df.astype(object).replace([np.nan, np.inf, -np.inf], None)
            preview = preview_df.to_dict(orient='records')
            columns = list(preview_df.columns)
            preview_data = {"columns": columns, "preview": preview}
            try:
                # This will raise a ValueError if NaN remains
                json_str = json.dumps(preview_data, allow_nan=False)
                preview_data = json.loads(json_str)
            except ValueError as e:
                logger.error(f"Preview data for sheet '{sheet_name}' contains non-JSON values: {str(e)}")
                preview_data = {"columns": columns, "preview": []}
        except Exception as e:
            logger.error(f"Failed to parse sheet '{sheet_name}' in '{filename}': {str(e)}", exc_info=True)
            preview_data = {"columns": [], "preview": []}
        sheet_entry = ExcelSheet(
            document_id=new_doc.id,
            sheet_name=sheet_name,
            header_row=None,
            column_mappings=None,
            preview_data=preview_data,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.session.add(sheet_entry)
        sheet_entries.append({
            "sheet_id": None,  # Will be set after commit
            "sheet_name": sheet_name,
            "columns": preview_data.get("columns", []),
            "preview": preview_data.get("preview", [])
        })

    db.session.commit()
    # Update sheet_ids in response
    for i, s in enumerate(ExcelSheet.query.filter_by(document_id=new_doc.id).all()):
        sheet_entries[i]["sheet_id"] = s.id

    logger.info(f"Excel file '{filename}' uploaded and persisted with {len(sheet_names)} sheets.")
    return jsonify({
        'message': f'File {filename} uploaded and persisted successfully',
        'policy_document_id': new_doc.id,
        'sheets': sheet_entries
    }), 201

@excel_bp.route('/map', methods=['POST'])
def map_excel_columns():
    """
    Accepts mapping of Excel columns to DB fields, processes the mapped data, and returns a preview.

    Expects JSON:
    {
        "path": "inputs/excel_uploads/filename.xlsx",
        "sheet_name": "Sheet1",
        "mapping": {
            "Excel Column 1": "db_field_1",
            "Excel Column 2": "db_field_2",
            ...
        }
    }
    """
    import pandas as pd

    data = request.get_json()
    path = data.get('path')
    sheet_name = data.get('sheet_name')
    mapping = data.get('mapping')

    if not path or not sheet_name or not mapping:
        logger.error("Missing required parameters in /map request")
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        df = pd.read_excel(path, sheet_name=sheet_name)
        # Only keep columns that are mapped
        df = df[list(mapping.keys())]
        # Rename columns to DB field names
        df = df.rename(columns=mapping)
        # Preview first 5 mapped rows
        preview = df.head(5).to_dict(orient='records')
        columns = list(df.columns)
        logger.info(f"Excel mapping applied for file '{path}', sheet '{sheet_name}'. Columns mapped: {mapping}")
    except Exception as e:
        logger.error(f"Failed to process mapped Excel data for file '{path}', sheet '{sheet_name}': {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to process mapped Excel data: {str(e)}'}), 400

    # Validation logic
    required_fields = ["employee_name", "shift_date", "shift_start", "shift_end"]  # Example required fields
    errors = []

    # Check for required fields
    missing_fields = [f for f in required_fields if f not in columns]
    if missing_fields:
        errors.append(f"Missing required fields: {', '.join(missing_fields)}")
        logger.warning(f"Missing required fields in mapping: {missing_fields}")

    # Type validation (example: shift_date should be date, shift_start/shift_end should be time or datetime)
    for idx, row in df.iterrows():
        row_errors = {}
        # Example: check if shift_date is a date
        if "shift_date" in df.columns:
            try:
                pd.to_datetime(row["shift_date"])
            except Exception:
                row_errors["shift_date"] = "Invalid date"
        # Example: check if shift_start/shift_end are present
        for col in ["shift_start", "shift_end"]:
            if col in df.columns and pd.isnull(row[col]):
                row_errors[col] = "Missing value"
        if row_errors:
            errors.append({"row": int(idx), "errors": row_errors})
            logger.warning(f"Validation error in row {idx}: {row_errors}")
        if len(errors) > 10:
            break  # Limit error reporting

    logger.info(f"Mapping preview complete for file '{path}', sheet '{sheet_name}'. Validation errors: {len(errors)}")
    return jsonify({
        'message': 'Mapping applied successfully',
        'columns': columns,
        'preview': preview,
        'validation_errors': errors
    }), 200
# Endpoint to commit validated, mapped Excel data to the database
@excel_bp.route('/commit', methods=['POST'])
def commit_excel_data():
    """
    Accepts normalized, validated Excel data and stores it in the database.

    Expects JSON:
    {
        "records": [
            {
                "employee_name": "...",
                "shift_date": "...",
                "shift_start": "...",
                "shift_end": "...",
                ...
            },
            ...
        ]
    }
    """
    from models import db, Employee, Shift
    import pandas as pd

    data = request.get_json()
    records = data.get('records')
    if not records or not isinstance(records, list):
        logger.error("No records provided in /commit request")
        return jsonify({'error': 'No records provided'}), 400

    inserted = 0
    updated = 0
    errors = []

    for idx, row in enumerate(records):
        try:
            # Normalize and parse fields
            employee_name = row.get('employee_name')
            shift_date = pd.to_datetime(row.get('shift_date')).date() if row.get('shift_date') else None
            shift_start = row.get('shift_start')
            shift_end = row.get('shift_end')

            # Find or create employee
            employee = Employee.query.filter_by(name=employee_name).first()
            if not employee:
                employee = Employee(name=employee_name)
                db.session.add(employee)
                db.session.flush()  # Get ID

            # Check for existing shift
            shift = Shift.query.filter_by(
                employee_id=employee.id,
                start_time=shift_start,
                end_time=shift_end,
                date=shift_date
            ).first()
            if shift:
                # Update shift if any field differs
                updated_fields = []
                if shift.start_time != shift_start:
                    shift.start_time = shift_start
                    updated_fields.append('start_time')
                if shift.end_time != shift_end:
                    shift.end_time = shift_end
                    updated_fields.append('end_time')
                if shift.date != shift_date:
                    shift.date = shift_date
                    updated_fields.append('date')
                if updated_fields:
                    updated += 1
                    logger.info(f"Updated shift for employee {employee_name} on {shift_date}: {updated_fields}")
                else:
                    logger.info(f"Duplicate shift found for employee {employee_name} on {shift_date}, no changes made.")
            else:
                # Create new shift
                shift = Shift(
                    employee_id=employee.id,
                    start_time=shift_start,
                    end_time=shift_end,
                    date=shift_date
                )
                db.session.add(shift)
                inserted += 1
        except Exception as e:
            logger.error(f"Error processing record {idx}: {str(e)}", exc_info=True)
            errors.append({'row': idx, 'error': str(e)})
            if len(errors) > 10:
                break

    try:
        db.session.commit()
        logger.info(f"Excel data import committed: {inserted} inserted, {updated} updated, {len(errors)} errors")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database commit failed: {str(e)}", exc_info=True)
        return jsonify({'error': f'Database commit failed: {str(e)}', 'errors': errors}), 500

    logger.info(f"Excel data import complete: {inserted} inserted, {updated} updated, {len(errors)} errors")
    return jsonify({
        'message': 'Excel data import complete',
        'inserted': inserted,
        'updated': updated,
        'errors': errors
    }), 200
@excel_bp.route('/', methods=['GET'])
def list_excel_documents():
    """
    List all uploaded Excel files and their sheets for document management UI.

    Returns:
        JSON: List of Excel uploads with metadata and associated sheets.
    """
    try:
        docs = PolicyDocument.query.filter_by(file_type='excel').order_by(PolicyDocument.uploaded_at.desc()).all()
        result = []
        for doc in docs:
            sheets = ExcelSheet.query.filter_by(document_id=doc.id).all()
            result.append({
                "id": doc.id,
                "filename": doc.filename,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "status": doc.status,
                "error_message": doc.error_message,
                "sheet_count": len(sheets),
                "sheets": [
                    {
                        "id": sheet.id,
                        "sheet_name": sheet.sheet_name,
                        "columns": sheet.preview_data.get("columns", []) if sheet.preview_data else [],
                        "preview": sheet.preview_data.get("preview", []) if sheet.preview_data else [],
                        "created_at": sheet.created_at.isoformat() if sheet.created_at else None,
                        "updated_at": sheet.updated_at.isoformat() if sheet.updated_at else None,
                    }
                    for sheet in sheets
                ]
            })
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error listing Excel documents: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch Excel documents'}), 500

# New endpoint: Delete an Excel document and its sheets
@excel_bp.route('/<int:doc_id>', methods=['DELETE'])
def delete_excel_document(doc_id):
    """
    Delete an uploaded Excel document and its associated sheets.

    Args:
        doc_id (int): The ID of the PolicyDocument to delete.

    Returns:
        JSON: Success or error message.
    """
    try:
        doc = PolicyDocument.query.filter_by(id=doc_id, file_type='excel').first()
        if not doc:
            return jsonify({'error': 'Document not found'}), 404

        # Delete associated ExcelSheet entries
        ExcelSheet.query.filter_by(document_id=doc.id).delete()

        # Delete file from disk if it exists
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except Exception as e:
                logger.warning(f"Failed to delete file from disk: {doc.file_path} ({str(e)})")

        # Delete the PolicyDocument record
        db.session.delete(doc)
        db.session.commit()
        logger.info(f"Deleted Excel document {doc.filename} (ID: {doc.id}) and associated sheets.")
        return jsonify({'message': 'Document deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting Excel document: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete document'}), 500