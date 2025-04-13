"""
Natural Language Understanding (NLU) utilities for supervisor scheduling queries.

Refactored for robustness using spaCy and dateparser.
- Uses spaCy for named entity recognition (employee names, dates).
- Uses dateparser for flexible date extraction.
- Data-driven pattern matching for shift types and intents.
"""

import re
from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict
from models import Employee, db

import spacy
import dateparser

class NLU:
    """
    Robust NLU for extracting entities and intent from scheduling queries.
    """

    # Data-driven patterns for shift types and intents
    SHIFT_TYPE_PATTERNS = {
        "Morning": [r"\bmorning\b", r"\bam shift\b", r"\bday shift\b"],
        "Afternoon": [r"\bafternoon\b"],
        "Evening": [r"\bevening\b", r"\bpm shift\b"],
        "Night": [r"\bnight\b", r"\bovernight\b"],
    }

    INTENT_PATTERNS = {
        "query": [r"\bwho works\b", r"\bwho is working\b", r"\blist\b"],
        "replace": [r"\bcalled off\b", r"\breplace\b", r"\bneed someone else\b"],
        "recommend": [r"\brecommend\b", r"\bsuggest\b"],
        "approve": [r"\bapprove\b", r"\byes\b", r"\bconfirm\b"],
    }

    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            raise RuntimeError(
                "spaCy model 'en_core_web_sm' not found. "
                "Run: python -m spacy download en_core_web_sm"
            )

    def extract_employee_names(self, query: str) -> List[str]:
        """
        Extracts employee names mentioned in the query using spaCy NER and Employee DB.

        Args:
            query (str): The user query.

        Returns:
            List[str]: List of matched employee names.
        """
        doc = self.nlp(query)
        # Get all employee names from DB
        employees = Employee.query.all()
        employee_names = [emp.name for emp in employees]
        found = set()
        # Use spaCy NER for PERSON entities
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                for name in employee_names:
                    if ent.text.lower() in name.lower() or name.lower() in ent.text.lower():
                        found.add(name)
        # Fallback: substring match for any employee name in query
        for name in employee_names:
            if name.lower() in query.lower():
                found.add(name)
        return list(found)

    def extract_dates(self, query: str) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        Extracts a date or date range from the query using dateparser.

        Args:
            query (str): The user query.

        Returns:
            Tuple[Optional[datetime], Optional[datetime]]: (start_date, end_date)
        """
        q = query.lower()
        # Handle "this month"
        if "this month" in q:
            today = datetime.today()
            first_day = today.replace(day=1)
            if today.month == 12:
                next_month = today.replace(year=today.year + 1, month=1, day=1)
            else:
                next_month = today.replace(month=today.month + 1, day=1)
            last_day = next_month - timedelta(days=1)
            return first_day, last_day

        # Use dateparser to find dates
        dates = list(dateparser.search.search_dates(query))
        if dates:
            # If only one date, treat as single day
            if len(dates) == 1:
                dt = dates[0][1]
                return dt, dt
            # If two or more, treat as range
            elif len(dates) >= 2:
                return dates[0][1], dates[1][1]
        return None, None

    def extract_shift_type(self, query: str) -> Optional[str]:
        """
        Extracts shift type from the query using data-driven patterns.

        Args:
            query (str): The user query.

        Returns:
            Optional[str]: 'Morning', 'Afternoon', 'Evening', 'Night', or None.
        """
        q = query.lower()
        for shift, patterns in self.SHIFT_TYPE_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, q):
                    return shift
        return None

    def extract_intent(self, query: str) -> str:
        """
        Extracts the intent of the query using data-driven patterns.

        Args:
            query (str): The user query.

        Returns:
            str: Intent label.
        """
        q = query.lower()
        for intent, patterns in self.INTENT_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, q):
                    return intent
        return "unknown"

# Backwards-compatible function API
_nlu = NLU()

def extract_employee_names(query: str) -> List[str]:
    return _nlu.extract_employee_names(query)

def extract_dates(query: str) -> Tuple[Optional[datetime], Optional[datetime]]:
    return _nlu.extract_dates(query)

def extract_shift_type(query: str) -> Optional[str]:
    return _nlu.extract_shift_type(query)

def extract_intent(query: str) -> str:
    return _nlu.extract_intent(query)