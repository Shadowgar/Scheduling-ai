import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExcelUpload from '../ExcelUpload';
import ExcelColumnMapper from '../ExcelColumnMapper';

// Mock fetch for upload, mapping, and commit
global.fetch = jest.fn();

describe('ExcelUpload and ExcelColumnMapper', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('shows preview after successful upload', async () => {
    // Mock upload response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        columns: ['employee_name', 'shift_date', 'shift_start', 'shift_end'],
        preview: [{ employee_name: 'Alice', shift_date: '2025-04-14', shift_start: '08:00', shift_end: '16:00' }],
        sheet_names: ['Sheet1'],
        message: 'File uploaded successfully'
      })
    });

    const onUploadResult = jest.fn();
    render(<ExcelUpload onUploadResult={onUploadResult} />);

    // Simulate file selection
    const file = new File(['dummy'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(screen.getByLabelText(/upload excel file/i) || screen.getByRole('textbox', { hidden: true }), {
      target: { files: [file] }
    });

    // Simulate upload
    fireEvent.click(screen.getByText(/upload/i));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/columns:/i)).toBeInTheDocument());
    expect(screen.getByText(/employee_name/)).toBeInTheDocument();
    expect(onUploadResult).toHaveBeenCalled();
  });

  it('shows validation errors in ExcelColumnMapper', async () => {
    // Mock mapping response with validation errors
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Mapping applied successfully',
        columns: ['employee_name', 'shift_date', 'shift_start'],
        preview: [{ employee_name: 'Alice', shift_date: '2025-04-14', shift_start: '08:00' }],
        validation_errors: ['Missing required fields: shift_end']
      })
    });

    render(
      <ExcelColumnMapper
        columns={['employee_name', 'shift_date', 'shift_start']}
        preview={[{ employee_name: 'Alice', shift_date: '2025-04-14', shift_start: '08:00' }]}
        filePath="dummy.xlsx"
        sheetName="Sheet1"
      />
    );

    // Simulate mapping and submit
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'employee_name' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'shift_date' } });
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'shift_start' } });
    fireEvent.click(screen.getByText(/submit mapping/i));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/missing required fields/i)).toBeInTheDocument());
  });

  it('commits data when mapping is valid', async () => {
    // Mock mapping response (no validation errors)
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Mapping applied successfully',
        columns: ['employee_name', 'shift_date', 'shift_start', 'shift_end'],
        preview: [
          { employee_name: 'Alice', shift_date: '2025-04-14', shift_start: '08:00', shift_end: '16:00' }
        ],
        validation_errors: []
      })
    });
    // Mock commit response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Excel data import complete',
        inserted: 1,
        updated: 0,
        errors: []
      })
    });

    render(
      <ExcelColumnMapper
        columns={['employee_name', 'shift_date', 'shift_start', 'shift_end']}
        preview={[
          { employee_name: 'Alice', shift_date: '2025-04-14', shift_start: '08:00', shift_end: '16:00' }
        ]}
        filePath="dummy.xlsx"
        sheetName="Sheet1"
      />
    );

    // Simulate mapping and submit
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'employee_name' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'shift_date' } });
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'shift_start' } });
    fireEvent.change(screen.getAllByRole('combobox')[3], { target: { value: 'shift_end' } });
    fireEvent.click(screen.getByText(/submit mapping/i));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    // Commit button should appear
    await waitFor(() => expect(screen.getByText(/commit data/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/commit data/i));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/excel data import complete/i)).toBeInTheDocument());
  });
});