# backend/services/ollama_service.py

# backend/services/ollama_service.py
import requests
import json
from flask import current_app
from datetime import datetime, timedelta
from models import db, Schedule, Employee, OllamaQuery

class OllamaService:
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        
    def generate(self, prompt, model="llama3", system_prompt=None, options=None):
        """
        Generate a response from Ollama
        
        Args:
            prompt (str): The user prompt
            model (str): The model to use (default: llama3)
            system_prompt (str): Optional system prompt
            options (dict): Optional model parameters
            
        Returns:
            dict: The response from Ollama
        """
        url = f"{self.api_url}/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        if options:
            payload["options"] = options
            
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Error calling Ollama API: {str(e)}")
            return {"error": str(e)}
    
    def get_schedule_data(self, start_date=None, end_date=None):
        """
        Get schedule data for a specific date range
        
        Args:
            start_date (datetime.date): Start date for schedule data
            end_date (datetime.date): End date for schedule data
            
        Returns:
            dict: Formatted schedule data
        """
        if not start_date:
            start_date = datetime.now().date()
        
        if not end_date:
            end_date = start_date + timedelta(days=14)  # Default to 2 weeks
        
        # Query schedules in the date range
        schedules = Schedule.query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).all()
        
        # Get all employees
        employees = Employee.query.all()
        
        # Format the data
        schedule_data = {
            "schedules": [schedule.to_dict() for schedule in schedules],
            "employees": [employee.to_dict() for employee in employees],
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
        
        return schedule_data
    
    def process_schedule_query(self, query, user_id, start_date=None, end_date=None):
        """
        Process a query about the schedule
        
        Args:
            query (str): The user's query about the schedule
            user_id (int): The ID of the user making the query
            start_date (datetime.date): Optional start date for schedule data
            end_date (datetime.date): Optional end date for schedule data
            
        Returns:
            dict: The processed response
        """
        # Get schedule data
        schedule_data = self.get_schedule_data(start_date, end_date)
        
        # Format the schedule data for the prompt
        schedule_context = json.dumps(schedule_data, indent=2)
        
        system_prompt = """
        You are a scheduling assistant for a workplace. You have access to the schedule data provided.
        Analyze the schedule data and respond to the user's query accurately and helpfully.
        If the user wants to make changes to the schedule, explain what changes would be made,
        but don't actually modify the data yourself.
        
        The schedule data includes:
        1. A list of schedules with employee assignments, dates, shifts, and times
        2. A list of employees with their roles and information
        3. The date range being examined
        
        Provide clear, concise answers and suggest actions when appropriate.
        """
        
        prompt = f"""
        Here is the current schedule data:
        {schedule_context}
        
        User query: {query}
        
        Please respond to this query based on the schedule data.
        """
        
        # Generate response from Ollama
        response = self.generate(prompt=prompt, system_prompt=system_prompt)
        
        # Store the query and response
        try:
            ollama_query = OllamaQuery(
                user_id=user_id,
                query=query,
                response=json.dumps(response),
                model_used="llama3"
            )
            db.session.add(ollama_query)
            db.session.commit()
        except Exception as e:
            current_app.logger.error(f"Error storing Ollama query: {str(e)}")
            db.session.rollback()
        
        return response
    
    def suggest_schedule(self, constraints, user_id):
        """
        Use Ollama to suggest an optimal schedule based on constraints
        
        Args:
            constraints (dict): Scheduling constraints
            user_id (int): The ID of the user requesting the suggestion
            
        Returns:
            dict: The suggested schedule
        """
        # Get employee data
        employees = Employee.query.all()
        employee_data = [employee.to_dict() for employee in employees]
        
        # Get existing schedules for context
        current_date = datetime.now().date()
        existing_schedules = Schedule.query.filter(
            Schedule.date >= current_date
        ).all()
        existing_schedule_data = [schedule.to_dict() for schedule in existing_schedules]
        
        # Create a prompt for Ollama
        system_prompt = """
        You are a scheduling assistant for a workplace. Your task is to create an optimal work schedule
        based on the provided constraints and employee information.
        
        Consider the following when creating a schedule:
        1. Employee roles and qualifications
        2. Fair distribution of shifts
        3. Avoiding scheduling conflicts
        4. Meeting staffing requirements
        5. Existing scheduled shifts
        
        Provide your response as a JSON object with clear explanations for your scheduling decisions.
        """
        
        prompt = f"""
        I need to create a work schedule with the following constraints:
        {json.dumps(constraints, indent=2)}
        
        Here are the employees available:
        {json.dumps(employee_data, indent=2)}
        
        Here are the existing scheduled shifts:
        {json.dumps(existing_schedule_data, indent=2)}
        
        Please suggest an optimal schedule that satisfies these constraints.
        Format your response as JSON with clear explanations.
        """
        
        # Generate response from Ollama
        response = self.generate(prompt=prompt, system_prompt=system_prompt)
        
        # Store the query and response
        try:
            ollama_query = OllamaQuery(
                user_id=user_id,
                query=json.dumps(constraints),
                response=json.dumps(response),
                model_used="llama3"
            )
            db.session.add(ollama_query)
            db.session.commit()
        except Exception as e:
            current_app.logger.error(f"Error storing Ollama query: {str(e)}")
            db.session.rollback()
        
        return response
