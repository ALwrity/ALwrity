"""
Quality Gate Manager

Manages all quality gates and provides comprehensive quality validation
for calendar generation.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .content_uniqueness_gate import ContentUniquenessGate
from .content_mix_gate import ContentMixGate
from .chain_context_gate import ChainContextGate
from .calendar_structure_gate import CalendarStructureGate
from .enterprise_standards_gate import EnterpriseStandardsGate
from .kpi_integration_gate import KPIIntegrationGate
from .onboarding_data_grounding_gate import OnboardingDataGroundingGate

logger = logging.getLogger(__name__)


class QualityGateManager:
    """
    Manages all quality gates and provides comprehensive quality validation.
    """
    
    def __init__(self):
        """Initialize the quality gate manager."""
        self.gates = {
            "content_uniqueness": ContentUniquenessGate(),
            "content_mix": ContentMixGate(),
            "chain_context": ChainContextGate(),
            "calendar_structure": CalendarStructureGate(),
            "enterprise_standards": EnterpriseStandardsGate(),
            "kpi_integration": KPIIntegrationGate(),
            "onboarding_data_grounding": OnboardingDataGroundingGate()
        }

        logger.info(f"Initialized QualityGateManager with {len(self.gates)} gates")
    
    async def validate_all_gates(self, calendar_data: Dict[str, Any], step_name: str = None) -> Dict[str, Any]:
        """
        Validate all quality gates against calendar data.
        
        Args:
            calendar_data: Calendar data to validate
            step_name: Optional step name for context-specific validation
            
        Returns:
            Comprehensive validation results
        """
        try:
            logger.info(f"Validating all quality gates for step: {step_name or 'general'}")
            
            validation_results = {
                "timestamp": datetime.utcnow().isoformat(),
                "step_name": step_name,
                "gates": {},
                "overall_score": 0.0,
                "passed_gates": 0,
                "failed_gates": 0,
                "recommendations": []
            }
            
            total_score = 0.0
            passed_count = 0
            failed_count = 0
            all_recommendations = []
            
            # Validate each gate
            for gate_name, gate in self.gates.items():
                try:
                    gate_result = await gate.validate(calendar_data, step_name)
                    validation_results["gates"][gate_name] = gate_result
                    
                    total_score += gate_result.get("score", 0.0)
                    
                    if gate_result.get("passed", False):
                        passed_count += 1
                    else:
                        failed_count += 1
                    
                    # Collect recommendations
                    recommendations = gate_result.get("recommendations", [])
                    all_recommendations.extend(recommendations)
                    
                except Exception as e:
                    logger.error(f"Error validating gate {gate_name}: {e}")
                    validation_results["gates"][gate_name] = {
                        "passed": False,
                        "score": 0.0,
                        "error": str(e),
                        "recommendations": [f"Fix validation error in {gate_name} gate"]
                    }
                    failed_count += 1
            
            # Calculate overall score
            validation_results["overall_score"] = total_score / len(self.gates) if self.gates else 0.0
            validation_results["passed_gates"] = passed_count
            validation_results["failed_gates"] = failed_count
            validation_results["recommendations"] = all_recommendations
            
            logger.info(f"Quality validation completed: {passed_count} passed, {failed_count} failed, overall score: {validation_results['overall_score']:.2f}")
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error in quality gate validation: {e}")
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "step_name": step_name,
                "error": str(e),
                "overall_score": 0.0,
                "passed_gates": 0,
                "failed_gates": len(self.gates),
                "recommendations": ["Fix quality gate validation system"]
            }
    
    async def validate_specific_gate(self, gate_name: str, calendar_data: Dict[str, Any], step_name: str = None) -> Dict[str, Any]:
        """
        Validate a specific quality gate.
        
        Args:
            gate_name: Name of the gate to validate
            calendar_data: Calendar data to validate
            step_name: Optional step name for context-specific validation
            
        Returns:
            Validation result for the specific gate
        """
        try:
            if gate_name not in self.gates:
                raise ValueError(f"Unknown quality gate: {gate_name}")
            
            gate = self.gates[gate_name]
            result = await gate.validate(calendar_data, step_name)
            
            logger.info(f"Gate {gate_name} validation: {'PASSED' if result.get('passed') else 'FAILED'} (score: {result.get('score', 0.0):.2f})")
            
            return result
            
        except Exception as e:
            logger.error(f"Error validating gate {gate_name}: {e}")
            return {
                "passed": False,
                "score": 0.0,
                "error": str(e),
                "recommendations": [f"Fix validation error in {gate_name} gate"]
            }
    
    def get_gate_info(self, gate_name: str = None) -> Dict[str, Any]:
        """
        Get information about quality gates.
        
        Args:
            gate_name: Optional specific gate name
            
        Returns:
            Gate information
        """
        if gate_name:
            if gate_name not in self.gates:
                return {"error": f"Unknown gate: {gate_name}"}
            
            gate = self.gates[gate_name]
            return {
                "name": gate_name,
                "description": gate.description,
                "criteria": gate.validation_criteria,
                "threshold": gate.pass_threshold
            }
        
        return {
            "total_gates": len(self.gates),
            "gates": {
                name: {
                    "description": gate.description,
                    "threshold": gate.pass_threshold
                }
                for name, gate in self.gates.items()
            }
        }
    
    def get_validation_summary(self) -> Dict[str, Any]:
        """
        Get a summary of all quality gates.
        
        Returns:
            Quality gate summary
        """
        return {
            "total_gates": len(self.gates),
            "gate_categories": list(self.gates.keys()),
            "description": "Comprehensive quality validation for calendar generation",
            "thresholds": {
                name: gate.pass_threshold for name, gate in self.gates.items()
            }
        }
    
    def __str__(self) -> str:
        """String representation of the quality gate manager."""
        return f"QualityGateManager(gates={len(self.gates)})"
    
    def __repr__(self) -> str:
        """Detailed string representation of the quality gate manager."""
        return f"QualityGateManager(gates={list(self.gates.keys())})"
