const pool=require("../db");

const normalize=(v)=>String(v||"").trim().toLowerCase();

const SUPER_USERS=["admin","it"];

const getPrimaryDepartment=(user)=>
  String(
    user?.department||
    user?.department_name||
    user?.user_department||
    user?.departmentName||
    user?.dept||
    ""
  ).trim();

const getDepartmentScopes=(user)=>{
  const primary=getPrimaryDepartment(user);

  const scopes=Array.isArray(user?.department_scopes)
    ? user.department_scopes
    : [];

  const all=[
    ...(primary?[primary]:[]),
    ...scopes,
  ]
    .map((d)=>String(d||"").trim())
    .filter(Boolean);

  const seen=new Set();

  return all.filter((department)=>{
    const key=normalize(department);

    if(!key||seen.has(key)){
      return false;
    }

    seen.add(key);
    return true;
  });
};

/*
  CHECK PERMISSION
  RETURNS TRUE/FALSE
*/
const hasPermission=async(user,moduleName,actionName)=>{
  try{
    const role=normalize(user?.role);

    if(!role){
      return false;
    }

    /*
      ADMIN + IT
      FULL ACCESS
    */
    if(SUPER_USERS.includes(role)){
      return true;
    }

    const departments=getDepartmentScopes(user);
    const normalizedDepartments=departments.map(normalize);

    /*
      1. CHECK ROLE + ALL DEPARTMENT SCOPES

      Example:
      TREAD AVP has:
      - TREAD DEPARTMENT
      - IT DEPARTMENT

      Permission check may match either department.
    */
    if(normalizedDepartments.length>0){
      const departmentResult=await pool.query(
        `
        SELECT
          allowed,
          department
        FROM public.role_permissions
        WHERE LOWER(TRIM(COALESCE(role,'')))=LOWER(TRIM($1))
          AND LOWER(TRIM(COALESCE(department,'')))=ANY($2::text[])
          AND module_name=$3
          AND action_name=$4
        `,
        [
          role,
          normalizedDepartments,
          moduleName,
          actionName,
        ]
      );

      /*
        Multiple department scopes mean the account
        may use the action if at least one scoped
        department explicitly allows it.

        The specific request department is still
        checked inside the module route.
      */
      if(departmentResult.rowCount>0){
        return departmentResult.rows.some(
          (row)=>Boolean(row.allowed)
        );
      }
    }

    /*
      2. FALLBACK ROLE-ONLY PERMISSION
    */
    const roleResult=await pool.query(
      `
      SELECT allowed
      FROM public.role_permissions
      WHERE LOWER(TRIM(COALESCE(role,'')))=LOWER(TRIM($1))
        AND (
          department IS NULL
          OR TRIM(department)=''
        )
        AND module_name=$2
        AND action_name=$3
      LIMIT 1
      `,
      [
        role,
        moduleName,
        actionName,
      ]
    );

    if(roleResult.rowCount===0){
      return false;
    }

    return Boolean(roleResult.rows[0].allowed);
  }catch(err){
    console.error(
      "HAS PERMISSION ERROR:",
      err.message
    );

    return false;
  }
};

/*
  EXPRESS MIDDLEWARE
*/
const requirePermission=(moduleName,actionName)=>{
  return async(req,res,next)=>{
    try{
      const allowed=await hasPermission(
        req.user,
        moduleName,
        actionName
      );

      if(!allowed){
        return res.status(403).json({
          message:`No permission for ${moduleName}:${actionName}`,
        });
      }

      return next();
    }catch(err){
      console.error(
        "PERMISSION ERROR:",
        err.message
      );

      return res.status(500).json({
        message:"Permission check failed",
      });
    }
  };
};

/*
  PERMISSION MAP FOR FRONTEND
*/
const getUserPermissionMap=async(user)=>{
  const role=normalize(user?.role);

  if(!role){
    return{
      is_super_user:false,
      permissions:{},
    };
  }

  if(SUPER_USERS.includes(role)){
    return{
      is_super_user:true,
      permissions:{},
    };
  }

  const departments=getDepartmentScopes(user);
  const normalizedDepartments=departments.map(normalize);

  let r;

  if(normalizedDepartments.length>0){
    r=await pool.query(
      `
      SELECT
        module_name,
        action_name,
        allowed,
        department
      FROM public.role_permissions
      WHERE LOWER(TRIM(COALESCE(role,'')))=LOWER(TRIM($1))
        AND (
          LOWER(TRIM(COALESCE(department,'')))=ANY($2::text[])
          OR department IS NULL
          OR TRIM(department)=''
        )
      ORDER BY id ASC
      `,
      [
        role,
        normalizedDepartments,
      ]
    );
  }else{
    r=await pool.query(
      `
      SELECT
        module_name,
        action_name,
        allowed,
        department
      FROM public.role_permissions
      WHERE LOWER(TRIM(COALESCE(role,'')))=LOWER(TRIM($1))
        AND (
          department IS NULL
          OR TRIM(department)=''
        )
      ORDER BY id ASC
      `,
      [role]
    );
  }

  console.log("ROLE =",role);
  console.log("PRIMARY DEPARTMENT =",getPrimaryDepartment(user));
  console.log("DEPARTMENT SCOPES =",departments);
  console.log("ROWS =",r.rows);

  const permissions={};

  for(const row of r.rows){
    if(!permissions[row.module_name]){
      permissions[row.module_name]={};
    }

    /*
      User has permission if ANY of their
      department scopes allows this action.

      Route-level department checks still control
      which actual records they may approve.
    */
    const current=Boolean(
      permissions[row.module_name][row.action_name]
    );

    permissions[row.module_name][row.action_name]=
      current||Boolean(row.allowed);
  }

  return{
    is_super_user:false,
    permissions,
  };
};

module.exports={
  requirePermission,
  hasPermission,
  getUserPermissionMap,
  getDepartmentScopes,
};