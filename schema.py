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

#here we create our pydantic checking for the incoming info: