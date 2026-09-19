from pydantic import BaseModel
#for validation
from typing import Optional
#for optional data.
from enum import Enum
#this is to make sure that the user can only select from a few range of type we specify.


#note schemas is for pydantic schemas.



class Reporttype(Enum):
    RESCUE = "rescue"
    MISSING = "missing"
    INJURED = "injured"
    SAFE = "safe"
    INCIDENT = "incident"


class Report(BaseModel):
    type:Reporttype
    message:str
    location:Optional[str]=None
    #we are adding latitude and longitude here... 
    #we are making sure these are additional as well.. cause if there is no location
    #there might be no latitude and longitude to work with.
    latitude:Optional[float]=None
    longitude:Optional[float]=None


class ReportResponse(BaseModel):
    id: int
    type:Reporttype
    message:str
    location:Optional[str] = None

    #adding functionality of latitude and longitude
    latitude:Optional[float]=None
    longitude:Optional[float]=None

    model_config = {
        "from_attributes":True
    }

#here we create our pydantic checking for the incoming info: