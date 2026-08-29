# MAIN IDEA

## Use of open-source technologies

The current project uses a connection with payed PACS, RaditechPACS, and it has integrations with that service. However the new project is to move to Orthanc PACS. The current project also uses Raditech WebViewer, we nned to integrate OHIF viewer to see the medical images.

## Current architecture

The current project uses Django for everything, the new project has to use Django for the backend only, we are going to use NextJS for the frontend. Django will be a REST API that will serve the data to NextJS. 

## General idea of the project

This project looks to fragment clinics, meaning, imagine this whole project as a SaaS, every clinic will host their own infraestructure, with their own PACS, their own backend and their own frontend, basically the whole infraestructure will be contained per clinic. Me (AROS Technologies) will host a patient portal where the patients can access the studies from all the clinics they have been too. We use a BYOS model, where the clinics pay for their own infrastructure (AWS/GCP), we only provide the software and the maintenance of the software, they have the obligation and they pay for the storage of the studies and DICOM images, we only pay for the patient portal. As you see in the current architecture, the PACS is divided into different actors, the assistants/receptionists, responsible for the creation of the study requests and the creation of accounts of patients that have none, they also currently are responsible for the authorization of the creation of associate doctors accounts. The doctors are the ones who perform the studies and create a report for it. The associate doctors are doctors that have their own accounts and can access studies from patients that have shared their studies with them.Finally there is the admin portal for the administrators of the clinics. 

