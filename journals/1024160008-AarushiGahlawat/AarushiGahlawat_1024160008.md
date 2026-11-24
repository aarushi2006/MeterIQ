# WEEKLY UPDATE OF AARUSHI GAHLAWAT(1024160008)

## 25/08/2026 — Data Flow Diagram Development

### Work Completed
- Created the Level 0 DFD representing the overall MeterIQ system and its interaction with external entities.
- Created the Level 1 DFD, decomposing the system into major processes such as data preprocessing, anomaly detection, load forecasting, and decision support.
- Created the Level 2 DFD to provide further detail about data movement within the major processes.
- Maintained consistency between the different DFD levels.

### Learning
Understood how DFDs represent the movement and transformation of data and how different levels provide increasing detail about a system.

### Challenges Faced
- Maintaining consistency between the three DFD levels.
- Deciding the appropriate level of detail.
- Representing the complete workflow without making the diagrams unnecessarily complex.

---

## 29/08/2026 — Dataset Exploration and Data Quality Analysis

### Work Completed
- Explored the available smart-meter datasets and examined attributes such as meter ID, timestamp, and electricity consumption.
- Investigated missing values, duplicate records, and inconsistent data.
- Studied the time-series characteristics of electricity consumption.
- Started preparing raw data for further analysis and ML processing.
- Identified important data fields required for subsequent analysis.

### Learning
Understood the importance of exploring and validating real-world datasets before applying machine learning techniques.

### Challenges Faced
- Understanding time-series data and its consumption patterns.
- Identifying relevant features without removing useful information.
- Handling data-quality issues while preserving meaningful observations.

---

## 09/09/2026 — EDA and Data Preprocessing

### Work Completed
- Performed Exploratory Data Analysis (EDA) on the smart-meter datasets.
- Analysed electricity consumption patterns and the structure of the available data.
- Investigated missing values, duplicate records, and other data-quality issues.
- Worked on data preprocessing to prepare the dataset for further ML processing.
- Studied temporal and consumption-related patterns.
- Analysed the requirements of anomaly/risk detection and short-term load forecasting.
- Studied suitable ML approaches for the two analytical tasks.

### Learning
Developed a better understanding of smart-meter time-series data, preprocessing techniques, and the requirements of anomaly detection and forecasting.

### Challenges Faced
- Understanding the structure and characteristics of the data.
- Handling data-quality issues while preserving useful patterns.
- Identifying features relevant to anomaly detection and forecasting.
- Understanding the suitability of different ML approaches.

### Current Status
EDA and initial data preprocessing were completed, and suitable approaches for the two ML tasks were studied.

---

## 14/09/2026 — ER Diagram and Activity Diagram

### Work Completed
- Completed the Entity Relationship (ER) Diagram for MeterIQ.
- Identified the major entities required for the system and represented their relationships.
- Designed the Activity Diagram to represent the step-by-step system workflow.
- Ensured consistency with the earlier DFDs and identified data requirements.
- Organised the diagrams for inclusion in the project documentation.

### Learning
Understood how an ER Diagram represents data entities and relationships, while an Activity Diagram represents the sequence of activities within a system.

### Challenges Faced
- Identifying appropriate entities and relationships.
- Representing the workflow clearly.
- Maintaining consistency between the ER Diagram, Activity Diagram, and DFDs.
- Choosing an appropriate level of detail.

---

## 14/09/2026 — Feature Engineering and Prepared Dataset

### Work Completed
- Worked on feature engineering for the prepared smart-meter data.
- Created temporal and consumption-related features for subsequent ML development.
- Prepared and reviewed the dataset for machine learning.
- Examined the suitability of the engineered features for anomaly/risk detection and short-term load forecasting.
- Updated the project documentation according to the development progress.

### Learning
Developed a better understanding of feature engineering for time-series data and its role in preparing useful inputs for machine learning models.

### Challenges Faced
- Selecting meaningful features while preserving consumption patterns.
- Handling time-dependent features appropriately.
- Ensuring the prepared dataset was suitable for the intended ML tasks.

### Current Status
The initial system diagrams, EDA, preprocessing, and feature engineering work were completed. The prepared dataset was ready for model development.

---

## 21/09/2026 — Initial ML Model Planning

### Work Completed
- Reviewed the requirements of the anomaly/risk detection and short-term load forecasting use cases.
- Studied possible machine learning approaches based on the characteristics of the prepared smart-meter dataset.
- Considered how consumption patterns and temporal features could be used by the analytical models.
- Reviewed the expected inputs and outputs of the ML components.
- Planned the next steps for model development and performance evaluation.

### Learning
Understood the importance of selecting ML approaches according to the problem requirements, data characteristics, and intended outputs.

### Challenges Faced
- Determining suitable approaches for two different analytical tasks.
- Understanding how time-series characteristics affect model selection.
- Identifying appropriate evaluation methods for the intended models.

---

## 05/10/2026 — Anomaly and Theft-Risk Detection Development

### Work Completed
- Started working on the ML component for identifying unusual smart-meter consumption behaviour.
- Explored how consumption patterns and engineered features could help identify potentially anomalous readings.
- Worked on the initial anomaly/risk detection workflow.
- Considered how anomaly results could be converted into useful risk-related information for further analysis.
- Reviewed how detection outputs could be represented for the MeterIQ dashboard.

### Learning
Developed a better understanding of anomaly detection in smart-meter data and how unusual consumption behaviour can be identified for further investigation.

### Challenges Faced
- Distinguishing unusual consumption from normal variations.
- Understanding the influence of consumption patterns on detection results.
- Considering how anomaly results should be interpreted before assigning risk.

---

## 12/10/2026 — Short-Term Load Forecasting Development

### Work Completed
- Worked on the short-term load forecasting component of MeterIQ.
- Reviewed the prepared time-series data and relevant temporal features.
- Explored how historical consumption information could support future load predictions.
- Considered the need to compare model predictions against actual consumption values.
- Reviewed how forecasting results could be presented to users through the dashboard.

### Learning
Understood the basic workflow of short-term load forecasting, including the use of historical observations, temporal features, and prediction evaluation.

### Challenges Faced
- Understanding consumption variations over time.
- Selecting appropriate historical information for forecasting.
- Evaluating predictions and interpreting forecasting errors.

---
## 14/10/2026 — Class Diagram Development

### Work Completed
- Worked on the UML Class Diagram for the MeterIQ system.
- Identified the main classes required to represent the system's structure.
- Defined relevant class attributes, operations, and relationships according to the planned system functionality.
- Reviewed the diagram for consistency with the ER Diagram, DFDs, and other system design documents.
- Organised the Class Diagram for inclusion in the project report.

### Learning
Understood how a UML Class Diagram represents the static structure of a system, including classes, attributes, methods, and relationships.

### Challenges Faced
- Identifying appropriate classes and their responsibilities.
- Distinguishing database entities from application-level classes.
- Representing relationships clearly while maintaining consistency with the existing diagrams.

---

## 19/10/2026 — ML Pipeline Development and Validation

### Work Completed
- Continued work on the ML workflow for smart-meter analytics.
- Reviewed the flow from prepared data and engineered features to analytical outputs.
- Examined the structure of the outputs required for anomaly detection and load forecasting.
- Worked on checking the consistency and usability of the data passed through the analytical workflow.
- Identified areas requiring further testing and validation.

### Learning
Understood the importance of validating the ML workflow and checking that data and outputs remain consistent throughout the pipeline.

### Challenges Faced
- Ensuring that data was suitable for the relevant analytical tasks.
- Checking the consistency of model inputs and outputs.
- Identifying issues that could affect the reliability of the results.

---
